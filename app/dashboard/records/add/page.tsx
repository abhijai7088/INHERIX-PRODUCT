import { Suspense } from "react";

import AddRecordClient from "./AddRecordClient";

export default async function AddRecordPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = searchParams ? await searchParams : {};

  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading secure upload form...</div>}>
      <AddRecordClient initialCategorySlug={params.category ?? null} />
    </Suspense>
  );
}
