import type { Pool } from "pg";

const DEFAULT_DOCUMENT_CATEGORIES = [
  {
    categoryName: "Identity Documents",
    description: "Government IDs, passports, and identity proof for controlled continuity release.",
  },
  {
    categoryName: "Bank Documents",
    description: "Statements, account references, and financial contact documents.",
  },
  {
    categoryName: "Insurance Documents",
    description: "Policy records, nominee references, and claim-support documents.",
  },
  {
    categoryName: "Property Documents",
    description: "Title deeds, ownership references, and estate records.",
  },
  {
    categoryName: "Medical Documents",
    description: "Medical proof, treatment summaries, and continuity verification documents.",
  },
  {
    categoryName: "Legal Documents",
    description: "Wills, powers of attorney, court instructions, and legal notices.",
  },
  {
    categoryName: "Business Documents",
    description: "Ownership records, operating references, and continuity handover files.",
  },
] as const;

export async function seedVaultCatalog(pool: Pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const category of DEFAULT_DOCUMENT_CATEGORIES) {
      await client.query(
        `INSERT INTO document_categories (category_name, description, is_active)
         SELECT $1::text, $2::text, TRUE
         WHERE NOT EXISTS (
           SELECT 1
           FROM document_categories
           WHERE lower(category_name::text) = lower($1::text)
         )`,
        [category.categoryName, category.description]
      );
    }

    await client.query("COMMIT");

    return {
      documentCategoriesSeeded: DEFAULT_DOCUMENT_CATEGORIES.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
