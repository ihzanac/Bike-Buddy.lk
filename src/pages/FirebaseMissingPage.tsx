import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export function FirebaseMissingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Firebase is not configured</CardTitle>
          <CardDescription>
            Create a <code className="rounded bg-surface-100 px-1">.env</code> file in the project
            root using <code className="rounded bg-surface-100 px-1">.env.example</code> as a
            template, then restart the dev server.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
