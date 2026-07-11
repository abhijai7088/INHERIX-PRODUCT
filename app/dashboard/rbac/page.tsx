"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { getRbacAdminData, updateRolePermissions, type RbacAdminPayload, type RbacPermission } from "@/lib/rbac-api";

type Role = "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";

export default function RbacPage() {
  const [payload, setPayload] = useState<RbacAdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role>("ADMIN");
  const [drafts, setDrafts] = useState<Record<Role, string[]>>({
    CUSTOMER: [],
    NOMINEE: [],
    VERIFICATION_OFFICER: [],
    ADMIN: [],
    SUPER_ADMIN: [],
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRbacAdminData();
        if (!active) {
          return;
        }

        setPayload(data);
        const nextDrafts = { ...drafts };
        for (const row of data.rolePermissions) {
          nextDrafts[row.role] = row.permissions;
        }
        setDrafts(nextDrafts);
      } catch {
        if (active) {
          setError("Unable to load RBAC permissions.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedPermissions = useMemo<Array<[string, RbacPermission[]]>>(() => {
    const groups = new Map<string, RbacAdminPayload["permissions"]>();
    for (const permission of payload?.permissions ?? []) {
      const group = groups.get(permission.module) ?? [];
      group.push(permission);
      groups.set(permission.module, group);
    }
    return [...groups.entries()] as Array<[string, RbacPermission[]]>;
  }, [payload]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="RBAC"
          description="A live role-permission editor for the operational and governance paths."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading RBAC permissions...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="RBAC"
          description="A live role-permission editor for the operational and governance paths."
        />
        <Card className="border-[#F2C9C9] bg-[#FFF7F7]">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold text-[#7F1D1D]">Live data unavailable</p>
            <p className="text-sm leading-6 text-[#991B1B]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const togglePermission = (permissionKey: string) => {
    setDrafts((current) => {
      const currentRolePermissions = new Set(current[selectedRole]);
      if (currentRolePermissions.has(permissionKey)) {
        currentRolePermissions.delete(permissionKey);
      } else {
        currentRolePermissions.add(permissionKey);
      }
      return {
        ...current,
        [selectedRole]: [...currentRolePermissions],
      };
    });
  };

  const saveRole = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateRolePermissions(selectedRole, drafts[selectedRole]);
      setMessage(`${selectedRole} permissions updated.`);
      const refreshed = await getRbacAdminData();
      setPayload(refreshed);
      setDrafts((current) => {
        const next = { ...current };
        for (const row of refreshed.rolePermissions) {
          next[row.role] = row.permissions;
        }
        return next;
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update RBAC permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="RBAC"
        description="A live role-permission editor for the operational and governance paths."
        actions={
          <Button onClick={saveRole} disabled={saving || loading}>
            {saving ? "Saving..." : "Save role"}
          </Button>
        }
      />

      {(message || error) && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{error ? "Action blocked" : "Update complete"}</p>
              <p className="text-sm text-slate-600">{error ?? message}</p>
            </div>
            {error ? <Badge variant="destructive">Attention</Badge> : <Badge variant="success">Saved</Badge>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          <SectionHeader
            title="Role selector"
            description="Choose a role and toggle its permissions. Changes are persisted through the backend RBAC ledger."
          />

          <div className="flex flex-wrap gap-2">
            {(["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] as Role[]).map((role) => (
              <Button
                key={role}
                type="button"
                variant={selectedRole === role ? "primary" : "outline"}
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(groupedPermissions.length ? groupedPermissions : [["system", payload?.permissions ?? []] as [string, RbacPermission[]]]).map(([module, permissions]) => (
              <Card key={module}>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#0F172A]">{module}</h3>
                    <Badge variant="secondary">{permissions.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {permissions.map((permission) => (
                      <label
                        key={permission.permissionKey}
                        className="flex items-start gap-3 rounded-2xl border border-[#E5ECF5] bg-white p-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={drafts[selectedRole].includes(permission.permissionKey)}
                          onChange={() => togglePermission(permission.permissionKey)}
                          className="mt-1"
                        />
                        <span className="space-y-1">
                          <span className="block font-semibold text-[#0F172A]">{permission.permissionKey}</span>
                          <span className="block text-xs text-slate-500">{permission.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
