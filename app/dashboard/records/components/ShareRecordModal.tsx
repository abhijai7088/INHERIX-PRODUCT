"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { createAccessRule } from "@/lib/access-rules";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { loadNominees, type NomineeApiRecord } from "@/lib/nominees";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  documentId?: string | null;
  documentTitle?: string | null;
  onCreated?: () => void;
}

const releaseConditions = [
  { value: "DEATH_EVENT", label: "Death event" },
  { value: "MEDICAL_INCAPACITY", label: "Medical incapacity" },
  { value: "LEGAL_EVENT", label: "Legal event" },
  { value: "EMERGENCY_ACCESS", label: "Emergency access" },
  { value: "OWNER_INACTIVE", label: "Owner inactive" },
  { value: "OTHER", label: "Other" },
] as const;

export default function ShareRecordModal({
  open,
  setOpen,
  documentId,
  documentTitle,
  onCreated,
}: Props) {
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);
  const [nomineeId, setNomineeId] = useState("");
  const [releaseCondition, setReleaseCondition] = useState<(typeof releaseConditions)[number]["value"]>("DEATH_EVENT");
  const [conditionNotes, setConditionNotes] = useState("");
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const authHelpText = "Sign in to load nominees.";

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await loadNominees();
        if (cancelled) {
          return;
        }

        setNominees(payload.nominees);
        setNomineeId((current) => current || payload.nominees[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load nominees."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedNominee = useMemo(
    () => nominees.find((nominee) => nominee.id === nomineeId) ?? null,
    [nomineeId, nominees]
  );

  async function handleCreateRule() {
    if (!documentId) {
      setError("A document is required before sharing.");
      return;
    }

    if (!nomineeId) {
      setError("Select a nominee to share with.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createAccessRule({
        nomineeId,
        documentId,
        canView,
        canDownload,
        releaseCondition,
        conditionNotes: conditionNotes.trim() || null,
      });

      setSuccess("Access rule created and audited.");
      setConditionNotes("");
      onCreated?.();
      setTimeout(() => setOpen(false), 500);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to share record."));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[32px] border border-[#DCE3EC] bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between border-b border-[#EEF2F7] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-[#0F172A]">Share record</h2>
            <p className="mt-1 text-sm text-slate-500">Create a controlled access rule for a nominee.</p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] transition hover:bg-slate-50"
            aria-label="Close share dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-xs text-slate-500">Document</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">
                {documentTitle ?? "Selected document"}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Nominee</label>
                <select
                  value={nomineeId}
                  onChange={(event) => setNomineeId(event.target.value)}
                  disabled={loading || !nominees.length}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C] disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  {nominees.length ? (
                    nominees.map((nominee) => (
                      <option
                        key={nominee.id}
                        value={nominee.id}
                      >
                        {nominee.fullName} {nominee.email ? `(${nominee.email})` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">No nominees available</option>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Release condition</label>
                <select
                  value={releaseCondition}
                  onChange={(event) => setReleaseCondition(event.target.value as (typeof releaseConditions)[number]["value"])}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                >
                  {releaseConditions.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                Preview allowed
                <input
                  type="checkbox"
                  checked={canView}
                  onChange={(event) => setCanView(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                Download allowed
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(event) => setCanDownload(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Notes</label>
              <textarea
                value={conditionNotes}
                onChange={(event) => setConditionNotes(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#163B8C]"
                placeholder="Optional internal notes"
              />
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                Loading nominees...
              </div>
            ) : null}

            {error === authHelpText ? (
              <div className="rounded-[24px] border border-[#C7D2FE] bg-[#EEF4FF] p-4 text-sm text-[#0F172A]">
                <p className="font-medium">{authHelpText}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sign back in to load nominees and create access rules.
                </p>
              </div>
            ) : error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            {selectedNominee ? (
              <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                <div className="flex items-start gap-3">
                  <UserPlus className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Selected nominee</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedNominee.fullName}
                      {selectedNominee.email ? ` • ${selectedNominee.email}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#EEF2F7] bg-white px-5 py-4 sm:px-6">
          <button
            onClick={() => void handleCreateRule()}
            disabled={saving || loading || !nominees.length || !documentId}
            className="h-12 w-full rounded-2xl bg-[#163B8C] text-sm font-medium text-white transition hover:bg-[#12306f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create access rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
