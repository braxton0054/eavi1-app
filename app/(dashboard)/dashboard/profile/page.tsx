import {
  changeEmail,
  changePassword,
  removeProfilePhoto,
  saveProfilePhoto,
} from "@/lib/actions/college/profile";
import { RecordForm } from "@/components/dashboard/record-form";
import { Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { common, pages, roles } from "@/lib/content/dashboard";
import { requireCollegeAdmin } from "@/lib/session";

const copy = pages.profile;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string; reason?: string }>;
}) {
  const { invalid, reason } = await searchParams;
  const scope = await requireCollegeAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={
          <p className="mt-1 text-sm text-eavi-muted-text">
            {copy.signedInAs(scope.fullName, roles[scope.role])}
          </p>
        }
      />

      {/* onSave names the exact refusal in `reason`; the generic sentence is only the
          fallback for a refusal that came with no message of its own. */}
      {invalid ? (
        <Notice tone="warning" title={common.errorTitle} body={reason || common.invalidSubmit} />
      ) : null}

      <Panel title={copy.photo.heading} description={copy.photo.description}>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          {/* A passport-format 3:4 frame, never a circle — the same crop everywhere. */}
          <span className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-eavi-plate ring-1 ring-eavi-border">
            {scope.photoUrl ? (
              // The object host only comes from the environment at runtime, so the picture
              // cannot be declared in next.config.ts's image allow-list.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={scope.photoUrl} alt={copy.photo.preview} className="size-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-eavi-muted-text">{copy.photo.none}</span>
            )}
          </span>

          <div className="min-w-0 flex-1 sm:max-w-md">
            <RecordForm
              id="profile-photo"
              fields={copy.photo.fields}
              action={saveProfilePhoto}
              submitLabel={copy.photo.button}
              aside={
                scope.photoUrl ? (
                  <form action={removeProfilePhoto}>
                    <Button type="submit" variant="outline">
                      {copy.photo.remove}
                    </Button>
                  </form>
                ) : null
              }
            />
          </div>
        </div>
      </Panel>

      <Panel title={copy.email.heading} description={copy.email.description}>
        <div className="flex flex-col gap-5 p-5 sm:max-w-md">
          <p className="text-sm">
            <span className="text-eavi-muted-text">{copy.email.current}: </span>
            <span className="font-medium">{scope.email}</span>
          </p>
          <RecordForm
            id="profile-email"
            fields={copy.email.fields}
            action={changeEmail}
            submitLabel={copy.email.button}
          />
        </div>
      </Panel>

      <Panel title={copy.password.heading} description={copy.password.description}>
        <div className="p-5 sm:max-w-lg">
          <RecordForm
            id="profile-password"
            fields={copy.password.fields}
            action={changePassword}
            submitLabel={copy.password.button}
          />
        </div>
      </Panel>
    </div>
  );
}
