import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  buckets: {
    // Public media (avatars, review photos, portfolio images): some of these
    // URLs are persisted in Postgres, so they must stay anonymously readable.
    assets: { access: "public_read" },
    // Sensitive documents (verification docs, dispute evidence): credential
    // required for every operation, read only via presigned URLs.
    documents: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
