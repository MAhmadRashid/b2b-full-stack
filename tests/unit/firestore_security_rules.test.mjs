import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Test suite validating the Firestore Security Rules AST and structure against security policies
test("Firestore Security Rules - Structural & Policy Validation", async (t) => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  assert.ok(fs.existsSync(rulesPath), "firestore.rules must exist");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  await t.test("1. Enforces rules_version 2", () => {
    assert.match(rules, /rules_version\s*=\s*'2';/);
  });

  await t.test("2. Helper functions exist and enforce authentication", () => {
    assert.match(rules, /function isAuthenticated\(\)\s*\{\s*return request\.auth != null;/);
    assert.match(rules, /function isSuperAdmin\(\)/);
    assert.match(rules, /function isOrgMember\(orgId\)/);
    assert.match(rules, /function isWorkspaceMember\(workspaceId\)/);
    assert.match(rules, /function isOwner\(userId\)/);
  });

  await t.test("3. Users collection: Denies create/delete to normal users, allows owner read/update", () => {
    const userMatch = rules.match(/match \/users\/\{userId\} \{([\s\S]*?)\}/);
    assert.ok(userMatch, "users collection match must exist");
    const userBody = userMatch[1];
    assert.ok(userBody.includes("isOwner(userId) || isSuperAdmin()"), "Read/update requires owner or superadmin");
    assert.ok(userBody.includes("allow create, delete: if isSuperAdmin();"), "Create/delete restricted to superadmin");
  });

  await t.test("4. Organizations & Workspaces: Enforces membership and OWNER/ADMIN role for mutations", () => {
    assert.ok(rules.includes("get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role in ['OWNER', 'ADMIN']"));
    assert.ok(rules.includes("get(/databases/$(database)/documents/workspaces/$(workspaceId)/members/$(request.auth.uid)).data.role in ['OWNER', 'ADMIN']"));
  });

  await t.test("5. Sensitive collections prevent client tampering (Server-only writes)", () => {
    // Audit logs: write only if superadmin (Admin SDK bypasses rules)
    const auditMatch = rules.match(/match \/auditLogs\/\{logId\} \{([\s\S]*?)\}/);
    assert.ok(auditMatch);
    assert.ok(auditMatch[1].includes("allow write: if isSuperAdmin();"));

    // Usage records: write only if superadmin
    const usageMatch = rules.match(/match \/usageRecords\/\{recordId\} \{([\s\S]*?)\}/);
    assert.ok(usageMatch);
    assert.ok(usageMatch[1].includes("allow write: if isSuperAdmin();"));

    // Subscriptions: write only if superadmin
    const subMatch = rules.match(/match \/subscriptions\/\{subscriptionId\} \{([\s\S]*?)\}/);
    assert.ok(subMatch);
    assert.ok(subMatch[1].includes("allow write: if isSuperAdmin();"));
  });

  await t.test("6. Analytics events schema validation on create", () => {
    const analyticsMatch = rules.match(/match \/analyticsEvents\/\{eventId\} \{([\s\S]*?)\}/);
    assert.ok(analyticsMatch);
    const body = analyticsMatch[1];
    assert.ok(body.includes("request.resource.data.sessionId is string"));
    assert.ok(body.includes("request.resource.data.eventName is string"));
    assert.ok(body.includes("request.resource.data.stage is string"));
    assert.ok(body.includes("allow update, delete: if isSuperAdmin();"));
  });

  await t.test("7. Tenant isolation: Resources require workspaceId or organizationId match", () => {
    // API keys
    assert.ok(rules.includes("isWorkspaceMember(resource.data.workspaceId)"));
    assert.ok(rules.includes("isOrgMember(resource.data.organizationId)"));
    // Daily analytics
    assert.ok(rules.includes("resource.data.scopeType == 'WORKSPACE' && isWorkspaceMember(resource.data.scopeId)"));
    assert.ok(rules.includes("resource.data.scopeType == 'ORGANIZATION' && isOrgMember(resource.data.scopeId)"));
  });
});

test("Firestore Indexes - Schema & Query Alignment Validation", async (t) => {
  const indexesPath = path.resolve(process.cwd(), "firestore.indexes.json");
  assert.ok(fs.existsSync(indexesPath), "firestore.indexes.json must exist");
  const indexData = JSON.parse(fs.readFileSync(indexesPath, "utf-8"));
  
  assert.ok(Array.isArray(indexData.indexes), "Must define an indexes array");
  const indexedCollections = indexData.indexes.map((idx) => idx.collectionGroup);

  await t.test("1. Composite indexes define required collections", () => {
    assert.ok(indexedCollections.includes("analyticsEvents"));
    assert.ok(indexedCollections.includes("dailyAnalytics"));
    assert.ok(indexedCollections.includes("auditLogs"));
    assert.ok(indexedCollections.includes("notifications"));
    assert.ok(indexedCollections.includes("apiKeys"));
  });

  await t.test("2. Analytics composite index covers equality filters + inequality/sort", () => {
    const analyticsIdx = indexData.indexes.find((i) => i.collectionGroup === "analyticsEvents");
    assert.deepEqual(analyticsIdx.fields, [
      { fieldPath: "workspaceId", order: "ASCENDING" },
      { fieldPath: "stage", order: "ASCENDING" },
      { fieldPath: "timestamp", order: "DESCENDING" },
    ]);
  });

  await t.test("3. Daily analytics composite index covers scope query + date range sort", () => {
    const dailyIdx = indexData.indexes.find((i) => i.collectionGroup === "dailyAnalytics");
    assert.deepEqual(dailyIdx.fields, [
      { fieldPath: "scopeType", order: "ASCENDING" },
      { fieldPath: "scopeId", order: "ASCENDING" },
      { fieldPath: "date", order: "DESCENDING" },
    ]);
  });
});
