export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">
              Sorry, something went wrong.
            </h2>
            {params?.error ? (
              <p className="text-sm text-gray-600">
                Code error: {params.error}
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                An unspecified error occurred.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}