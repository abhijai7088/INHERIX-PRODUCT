"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BadgeCheck, Building2, Camera, Mail, Phone, RefreshCw, UserRound } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { FieldHint, FieldLabel, FormField } from "@/components/inherix/field";
import { getAccountLabel, getInitials } from "@/lib/account";
import { formatDateTime } from "@/lib/records";

import { useProfile } from "@/hooks/use-profile";

export default function AccountProfilePage() {
  const { account, loading, updateAccount, refresh, isSectionVisible, getSection } = useProfile();
  const section = getSection("account");
  const isVisible = isSectionVisible("account");
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!account) {
      return;
    }

    setFullName(account.fullName);
    setMobile(account.mobile ?? "");

    // Load stored profile image from localStorage
    const storageKey = `inherix_profile_photo_${account.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setProfileImage(stored);
    }
  }, [account]);

  const hasChanges = useMemo(() => {
    if (!account) {
      return false;
    }

    return fullName.trim() !== account.fullName || (mobile.trim() || null) !== (account.mobile ?? null);
  }, [account, fullName, mobile]);

  if (!loading && !isVisible) {
    return (
      <Card>
        <CardContent>
          <Notice title="Account section unavailable">
            {section?.reason ?? "This section is not available for the current role."}
          </Notice>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFormError(null);

    const nextFullName = fullName.trim();
    const nextMobile = mobile.trim();

    if (!nextFullName) {
      setFormError("Full name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await updateAccount({
          fullName: nextFullName,
          mobile: nextMobile ? nextMobile : null,
        });
        setMessage("Account details were updated and written to the audit trail.");
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Unable to update account details.");
      }
    });
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Profile photo must be 5 MB or smaller.");
      return;
    }

    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setProfileImage(dataUrl);
      if (account?.id) {
        localStorage.setItem(`inherix_profile_photo_${account.id}`, dataUrl);
      }
      setImageUploading(false);
      setMessage("Profile photo updated successfully.");
    };
    reader.onerror = () => {
      setFormError("Unable to read the selected image.");
      setImageUploading(false);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    event.target.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Account"
        description="Update your identity and contact details from the live profile record. Changes are persisted immediately and audited."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {message ? (
        <Notice title="Saved">
          {message}
        </Notice>
      ) : null}

      {formError ? (
        <Notice title="Unable to save" className="border-red-200 bg-red-50 text-red-700">
          {formError}
        </Notice>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Identity"
              description="The backend stores the account record. Email remains read-only here because it is tied to authentication state."
            />

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                </FormField>

                <FormField>
                  <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
                  <Input
                    id="mobile"
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder="+91 90000 00000"
                    autoComplete="tel"
                  />
                  <FieldHint>
                    Mobile changes are persisted to the profile aggregate and audited.
                  </FieldHint>
                </FormField>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending || !hasChanges}>
                  <BadgeCheck className="h-4 w-4" />
                  {isPending ? "Saving..." : "Save account"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refresh()}>
                  <RefreshCw className="h-4 w-4" />
                  Reload profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Current profile"
                description="Live account metadata pulled from the backend."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    <UserRound className="h-3.5 w-3.5" />
                    Name
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.fullName ?? "Loading..."}</p>
                </div>

                <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.email ?? "Loading..."}</p>
                </div>

                <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    Contact
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.mobile ?? "Not provided"}</p>
                </div>

                <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    <Building2 className="h-3.5 w-3.5" />
                    Role
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account ? getAccountLabel(account.role) : "Loading..."}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={account?.status === "ACTIVE" ? "success" : "secondary"}>{account?.status ?? "Loading"}</Badge>
                <Badge variant={account?.mfaEnabled ? "success" : "warning"}>{account?.mfaEnabled ? "MFA enabled" : "MFA disabled"}</Badge>
                <Badge variant="secondary">{account?.isEmailVerified ? "Email verified" : "Email pending"}</Badge>
                <Badge variant="secondary">{account?.isMobileVerified ? "Mobile verified" : "Mobile pending"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Lifecycle"
                description="Profile metadata that helps explain the current account state."
              />

              <div className="space-y-3">
                {[
                  { label: "Created", value: account?.createdAt ? formatDateTime(account.createdAt) : "Not available" },
                  { label: "Updated", value: account?.updatedAt ? formatDateTime(account.updatedAt) : "Not available" },
                  { label: "Last login", value: account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Not available" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[22px] border border-[#E5ECF5] bg-white px-4 py-3">
                    <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.value}</p>
                  </div>
                ))}
              </div>

              <Notice title="Audit trail">
                {`Updating the account writes a profile audit event for ${account ? getAccountLabel(account.role) : "the current account"}.`}
              </Notice>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
