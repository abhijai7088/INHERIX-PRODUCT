import { createHash, createHmac, randomUUID } from "node:crypto";
import readline from "node:readline";
import tls from "node:tls";
import type { TLSSocket } from "node:tls";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailService = {
  sendVerificationEmail(to: string, token: string, fullName: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string, fullName: string): Promise<void>;
  sendMfaChallengeEmail(to: string, fullName: string, code: string, role: string): Promise<void>;
  sendNomineeInvitationEmail(
    to: string,
    nomineeName: string,
    inviterName: string,
    relationship: string,
    invitationUrl: string
  ): Promise<void>;
};

function buildFrontendUrl(env: AppEnv, path: string) {
  const origin = env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  return new URL(path, origin).toString();
}

function resolveFromAddress(env: AppEnv) {
  return (env.EMAIL_FROM ?? env.EMAIL_GMAIL_USER ?? "").trim();
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEnvelopeAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function dotStuff(body: string) {
  return body
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Uint8Array | string, value: string): Buffer;
function hmacSha256(key: Uint8Array | string, value: string, encoding: "hex"): string;
function hmacSha256(key: Uint8Array | string, value: string, encoding?: "hex"): Buffer | string {
  const hmac = createHmac("sha256", key);
  hmac.update(value, "utf8");
  return encoding === "hex" ? hmac.digest("hex") : hmac.digest();
}

function toAmzDate(date = new Date()) {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function getAwsSesConfig(env: AppEnv) {
  const region = env.AWS_SES_REGION?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = env.AWS_SESSION_TOKEN?.trim();

  if (!region) {
    throw new Error("AWS_SES_REGION is required for the SES email provider.");
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for the SES email provider.");
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken || null,
  };
}

function buildSesBody(message: EmailMessage, fromAddress: string) {
  const content: {
    Simple: {
      Subject: { Data: string; Charset: string };
      Body: {
        Text: { Data: string; Charset: string };
        Html?: { Data: string; Charset: string };
      };
    };
  } = {
    Simple: {
      Subject: {
        Data: message.subject,
        Charset: "UTF-8",
      },
      Body: {
        Text: {
          Data: message.text,
          Charset: "UTF-8",
        },
      },
    },
  };

  if (message.html) {
    content.Simple.Body.Html = {
      Data: message.html,
      Charset: "UTF-8",
    };
  }

  return {
    FromEmailAddress: normalizeEnvelopeAddress(fromAddress),
    Destination: {
      ToAddresses: [normalizeEnvelopeAddress(message.to)],
    },
    Content: content,
  };
}

function deriveAwsSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function buildSesSignedHeaders(
  env: AppEnv,
  requestTarget: URL,
  payloadHash: string,
  amzDate: string,
  body: string
) {
  const { region, accessKeyId, secretAccessKey, sessionToken } = getAwsSesConfig(env);
  const service = "ses";
  const host = requestTarget.host;
  const signedHeaders = ["content-type", "host", "x-amz-content-sha256", "x-amz-date"];

  const headers: Record<string, string> = {
    "content-type": "application/json",
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
    signedHeaders.push("x-amz-security-token");
  }

  const canonicalHeaders = signedHeaders
    .slice()
    .sort()
    .map((header) => `${header}:${headers[header]}`)
    .join("\n");
  const canonicalSignedHeaders = signedHeaders.slice().sort().join(";");
  const canonicalRequest = [
    "POST",
    requestTarget.pathname,
    "",
    canonicalHeaders,
    "",
    canonicalSignedHeaders,
    payloadHash,
  ].join("\n");

  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveAwsSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign, "hex");

  return {
    accessKeyId,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${canonicalSignedHeaders}, Signature=${signature}`,
    },
  };
}

async function sendSesMessage(env: AppEnv, message: EmailMessage, fromAddress: string) {
  const { region } = getAwsSesConfig(env);
  const endpoint = new URL(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`);
  const amzDate = toAmzDate();
  const body = JSON.stringify(buildSesBody(message, fromAddress));
  const payloadHash = sha256Hex(body);
  const { headers } = buildSesSignedHeaders(env, endpoint, payloadHash, amzDate, body);

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `SES rejected the message with status ${response.status}${responseText ? `: ${responseText}` : ""}.`
    );
  }
}

function buildMimeMessage(message: EmailMessage, fromAddress: string) {
  const subject = escapeHeaderValue(message.subject);
  const toAddress = escapeHeaderValue(message.to);
  const boundary = `inherix-${randomUUID()}`;
  const plainText = message.text.replace(/\r?\n/g, "\r\n");
  const html = (message.html ?? `<pre>${escapeHtml(message.text)}</pre>`).replace(/\r?\n/g, "\r\n");

  if (!message.html) {
    return [
      `From: ${fromAddress}`,
      `To: ${toAddress}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      plainText,
      "",
    ].join("\r\n");
  }

  return [
    `From: ${fromAddress}`,
    `To: ${toAddress}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function connectSecureSocket(host: string, port: number) {
  return new Promise<TLSSocket>((resolve, reject) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
    });

    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function createLineReader(socket: TLSSocket) {
  const rl = readline.createInterface({ input: socket, crlfDelay: Infinity });
  const queue: string[] = [];
  const waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  let ended = false;
  let failure: Error | null = null;

  rl.on("line", (line) => {
    if (waiters.length) {
      waiters.shift()?.resolve(line);
      return;
    }

    queue.push(line);
  });

  const settleWaiters = () => {
    while (waiters.length && queue.length) {
      waiters.shift()?.resolve(queue.shift()!);
    }

    if (failure) {
      while (waiters.length) {
        waiters.shift()?.reject(failure);
      }
      return;
    }

    if (ended) {
      while (waiters.length) {
        waiters.shift()?.reject(new Error("The SMTP connection closed unexpectedly."));
      }
    }
  };

  socket.once("close", () => {
    ended = true;
    settleWaiters();
  });

  socket.once("error", (error) => {
    failure = error instanceof Error ? error : new Error(String(error));
    settleWaiters();
  });

  return {
    nextLine() {
      if (failure) {
        return Promise.reject(failure);
      }

      if (queue.length) {
        return Promise.resolve(queue.shift()!);
      }

      if (ended) {
        return Promise.reject(new Error("The SMTP connection closed unexpectedly."));
      }

      return new Promise<string>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
    close() {
      rl.close();
    },
  };
}

async function readSmtpResponse(nextLine: () => Promise<string>) {
  const firstLine = await nextLine();
  const firstMatch = firstLine.match(/^(\d{3})([ -])(.*)$/);

  if (!firstMatch) {
    throw new Error(`Unexpected SMTP response: ${firstLine}`);
  }

  const code = Number(firstMatch[1]);
  const lines = [firstMatch[3] ?? ""];
  let separator = firstMatch[2];

  while (separator === "-") {
    const line = await nextLine();
    const match = line.match(/^(\d{3})([ -])(.*)$/);

    if (!match || Number(match[1]) !== code) {
      throw new Error(`Unexpected SMTP response: ${line}`);
    }

    lines.push(match[3] ?? "");
    separator = match[2];
  }

  return { code, lines };
}

async function writeCommand(socket: TLSSocket, command: string) {
  await new Promise<void>((resolve, reject) => {
    socket.write(`${command}\r\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function expectSmtpResponse(nextLine: () => Promise<string>, command: string, expectedCodes: number[]) {
  const response = await readSmtpResponse(nextLine);

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command ${command} failed with ${response.code}: ${response.lines.join(" | ")}`);
  }

  return response;
}

async function sendSmtpMessage(
  message: EmailMessage,
  options: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromAddress: string;
    secure: boolean;
  }
) {
  const socket = options.secure
    ? await connectSecureSocket(options.host, options.port)
    : await new Promise<TLSSocket>((resolve, reject) => {
        const plain = tls.connect({
          host: options.host,
          port: options.port,
          servername: options.host,
          rejectUnauthorized: true,
        });

        plain.once("secureConnect", () => resolve(plain));
        plain.once("error", reject);
      });

  const reader = createLineReader(socket);

  try {
    await expectSmtpResponse(reader.nextLine, "greeting", [220]);
    await writeCommand(socket, "EHLO localhost");
    await expectSmtpResponse(reader.nextLine, "EHLO", [250]);

    await writeCommand(socket, "AUTH LOGIN");
    await expectSmtpResponse(reader.nextLine, "AUTH LOGIN", [334]);

    await writeCommand(socket, Buffer.from(options.username, "utf8").toString("base64"));
    await expectSmtpResponse(reader.nextLine, "AUTH LOGIN username", [334]);

    await writeCommand(socket, Buffer.from(options.password, "utf8").toString("base64"));
    await expectSmtpResponse(reader.nextLine, "AUTH LOGIN password", [235]);

    await writeCommand(socket, `MAIL FROM:<${normalizeEnvelopeAddress(options.fromAddress)}>`);
    await expectSmtpResponse(reader.nextLine, "MAIL FROM", [250]);

    await writeCommand(socket, `RCPT TO:<${normalizeEnvelopeAddress(message.to)}>`);
    await expectSmtpResponse(reader.nextLine, "RCPT TO", [250, 251]);

    await writeCommand(socket, "DATA");
    await expectSmtpResponse(reader.nextLine, "DATA", [354]);

    const mimeMessage = buildMimeMessage(message, options.fromAddress);
    await new Promise<void>((resolve, reject) => {
      socket.write(`${dotStuff(mimeMessage).replace(/\r?\n/g, "\r\n")}\r\n.\r\n`, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await expectSmtpResponse(reader.nextLine, "message body", [250]);

    await writeCommand(socket, "QUIT");
    await expectSmtpResponse(reader.nextLine, "QUIT", [221]);
  } finally {
    reader.close();
    socket.end();
  }
}

async function sendSendGridMessage(env: AppEnv, message: EmailMessage, fromAddress: string) {
  if (!env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is required for the SendGrid email provider.");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: normalizeEnvelopeAddress(fromAddress) },
      subject: message.subject,
      content: [
        { type: "text/plain", value: message.text },
        ...(message.html ? [{ type: "text/html", value: message.html }] : []),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid rejected the message with status ${response.status}.`);
  }
}

function getGmailAuthConfig(env: AppEnv) {
  if (!env.EMAIL_GMAIL_USER || !env.EMAIL_GMAIL_APP_PASSWORD) {
    throw new Error("EMAIL_GMAIL_USER and EMAIL_GMAIL_APP_PASSWORD are required for the Gmail email provider.");
  }

  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    username: env.EMAIL_GMAIL_USER,
    password: env.EMAIL_GMAIL_APP_PASSWORD,
  };
}

function logDevelopmentEmail(logger: Logger, message: EmailMessage) {
  logger.info("Development email preview", {
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

export function createEmailService(env: AppEnv, logger: Logger): EmailService {
  const fromAddress = resolveFromAddress(env);

  async function send(message: EmailMessage) {
    if (env.NODE_ENV !== "production" && env.EMAIL_PROVIDER === "development") {
      logDevelopmentEmail(logger, message);
      return;
    }

    if (!fromAddress) {
      throw new Error("EMAIL_FROM or EMAIL_GMAIL_USER is required to send auth emails.");
    }

    if (env.EMAIL_PROVIDER === "gmail") {
      const gmail = getGmailAuthConfig(env);
      await sendSmtpMessage(message, {
        ...gmail,
        fromAddress,
      });
      return;
    }

    if (env.EMAIL_PROVIDER === "sendgrid") {
      await sendSendGridMessage(env, message, fromAddress);
      return;
    }

    if (env.EMAIL_PROVIDER === "ses") {
      await sendSesMessage(env, message, fromAddress);
      return;
    }

    logDevelopmentEmail(logger, message);
  }

  return {
    async sendVerificationEmail(to, token, fullName) {
      const verificationUrl = buildFrontendUrl(
        env,
        `/onboarding/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`
      );
      await send({
        to,
        subject: "Verify your INHERIX email address",
        text: `Hello ${fullName},\n\nVerify your INHERIX email address:\n${verificationUrl}\n\nThis link expires soon and can only be used once.`,
        html: `<p>Hello ${fullName},</p><p>Verify your INHERIX email address:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires soon and can only be used once.</p>`,
      });
    },
    async sendPasswordResetEmail(to, token, fullName) {
      const resetUrl = buildFrontendUrl(
        env,
        `/onboarding/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`
      );
      await send({
        to,
        subject: "Reset your INHERIX password",
        text: `Hello ${fullName},\n\nReset your INHERIX password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hello ${fullName},</p><p>Reset your INHERIX password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    },
    async sendMfaChallengeEmail(to, fullName, code, role) {
      await send({
        to,
        subject: "Your INHERIX sign-in verification code",
        text: [
          `Hello ${fullName},`,
          "",
          `Your ${role.toLowerCase()} sign-in verification code is: ${code}`,
          "",
          "This code expires soon and can only be used once.",
          "If you did not request this, please secure your account immediately.",
        ].join("\n"),
        html: [
          `<p>Hello ${fullName},</p>`,
          `<p>Your <strong>${escapeHtml(role.toLowerCase())}</strong> sign-in verification code is:</p>`,
          `<p style="font-size: 28px; font-weight: 800; letter-spacing: 0.18em;">${escapeHtml(code)}</p>`,
          `<p>This code expires soon and can only be used once.</p>`,
          `<p>If you did not request this, please secure your account immediately.</p>`,
        ].join(""),
      });
    },
    async sendNomineeInvitationEmail(to, nomineeName, inviterName, relationship, invitationUrl) {
      await send({
        to,
        subject: "You have been invited to INHERIX",
        text: [
          `Hello ${nomineeName},`,
          "",
          `${inviterName} has invited you to INHERIX as a ${relationship}.`,
          `Accept your invitation here: ${invitationUrl}`,
          "",
          "This invitation link is private, time-limited, and can only be used once.",
        ].join("\n"),
        html: [
          `<p>Hello ${nomineeName},</p>`,
          `<p>${inviterName} has invited you to INHERIX as a ${relationship}.</p>`,
          `<p><a href="${invitationUrl}">Accept your invitation</a></p>`,
          `<p>This invitation link is private, time-limited, and can only be used once.</p>`,
        ].join(""),
      });
    },
  };
}
