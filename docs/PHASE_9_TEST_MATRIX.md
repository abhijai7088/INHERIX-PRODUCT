# Phase 9 Test Case Matrix

| ID | Area | Scenario | Expected Result | Priority |
|---|---|---|---|---|
| AUTH-01 | Authentication | Register a new account | Account creation succeeds and onboarding continues | High |
| AUTH-02 | Authentication | Login with valid credentials | Session is created and user is routed correctly | High |
| AUTH-03 | Authentication | Login with invalid credentials | Access is denied and no sensitive data is revealed | High |
| AUTH-04 | Authentication | Reset password flow | Reset flow completes without exposing secrets | High |
| SESS-01 | Session | Session timeout | Expired sessions are rejected | High |
| SESS-02 | Session | Token expiry | Expired tokens are blocked | High |
| RBAC-01 | Authorization | Customer opens another customer’s data | Access is denied | High |
| RBAC-02 | Authorization | Nominee opens full vault | Access is denied | High |
| RBAC-03 | Authorization | Nominee views unreleased document | Access is denied | High |
| RBAC-04 | Authorization | Admin bypasses workflow | Bypass is blocked | High |
| RBAC-05 | Authorization | Invalid role accesses protected page | Access is denied | High |
| VAULT-01 | Vault | Create vault | Vault is created and audited | High |
| VAULT-02 | Vault | Upload document metadata | Metadata persists and file is stored externally | High |
| VAULT-03 | Vault | Search and filter records | Results are scoped and correct | Medium |
| NOM-01 | Nominees | Invite nominee | Nominee is created and invitation is logged | High |
| NOM-02 | Nominees | Accept nominee invitation | Status updates correctly and is audited | High |
| RULE-01 | Access rules | Add access rule | Rule is created with correct scope | High |
| RULE-02 | Access rules | Revoke access rule | Rule becomes inactive and audit is written | High |
| TRIG-01 | Trigger | Create trigger request | Request is created in draft / pending state | High |
| TRIG-02 | Trigger | Upload proof | Proof metadata is stored securely | High |
| TRIG-03 | Trigger | Request additional info | Workflow updates and notifications are produced | Medium |
| TRIG-04 | Trigger | Approve request | Request transitions to approved only after review | High |
| TRIG-05 | Trigger | Reject request | Request transitions to rejected and is audited | High |
| REL-01 | Release | Create selective release | Only eligible documents can be released | High |
| REL-02 | Release | Attempt full vault release | Action is blocked | High |
| REL-03 | Release | Released document access | Nominee can only access explicitly released docs | High |
| REL-04 | Release | Access revoked release | Access is denied after revoke | High |
| AUD-01 | Audit | Login event logged | Audit entry exists and is append-only | High |
| AUD-02 | Audit | Upload / view / download logged | All events are recorded | High |
| AUD-03 | Audit | Release event logged | Controlled release events are recorded | High |
| NOTIF-01 | Notifications | Security notice delivered | Notice appears for correct role | Medium |
| NOTIF-02 | Notifications | Release notice delivered | Nominee receives release notification | High |
| SEC-01 | Security | Password policy enforced | Weak passwords are rejected | High |
| SEC-02 | Security | Signed URL expires | Access fails after expiry | High |
| SEC-03 | Security | Logs redact secrets | No raw secrets appear in logs | High |
| UI-01 | UI | Mobile layout check | Pages remain usable on small screens | Medium |
| UI-02 | UI | Empty state rendering | Empty states are clear and branded | Medium |
| DEP-01 | Build | Production build | Build succeeds | High |
| DEP-02 | Deployment | Staging smoke test | Critical flows pass in staging | High |
| DEP-03 | Deployment | Rollback readiness | Rollback path is documented and testable | High |

