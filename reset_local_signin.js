const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const client = new Client({
  connectionString: "postgresql://inherix_app:Inherix%402026AppDB@localhost:5432/inherix_mvp",
});

const accounts = [
  {
    email: "abhijai7088@gmail.com",
    fullName: "Amit Tyagi",
    role: "VERIFICATION_OFFICER",
  },
  {
    email: "sixer3080@gmail.com",
    fullName: "Sixer Nominee",
    role: "NOMINEE",
  },
];
const temporaryPassword = "Inherix@123";

async function run() {
  await client.connect();

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  for (const account of accounts) {
    const result = await client.query(
      `INSERT INTO users (
         full_name,
         email,
         password_hash,
         role,
         status,
         is_email_verified,
         is_mobile_verified,
         mfa_enabled,
         must_reset_password
       )
       VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, TRUE, FALSE, FALSE)
       ON CONFLICT (email)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         status = 'ACTIVE',
         is_email_verified = TRUE,
         is_mobile_verified = TRUE,
         mfa_enabled = FALSE,
         must_reset_password = FALSE,
         updated_at = CURRENT_TIMESTAMP`,
      [account.fullName, account.email, passwordHash, account.role]
    );

    console.log(`Upserted ${account.email}: ${result.rowCount} row(s)`);
  }

  await client.query(
    `DELETE FROM security_events
     WHERE event_type IN ('LOGIN_FAILED', 'MFA_CHALLENGE_FAILED')`
  );

  await client.query("UPDATE user_sessions SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP WHERE is_active = TRUE");

  console.log(`Temporary login password set to: ${temporaryPassword}`);
  console.log("Use either officer account email to sign in.");

  await client.end();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
