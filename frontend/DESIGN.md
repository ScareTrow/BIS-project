# ASAR Design System

Use the same light surfaces, typography and controls on public and admin pages.
Prefer a light gray page, white cards with thin borders, and blue for links and
primary actions. Use color alongside a label when conveying status.

| Element | Standard |
| --- | --- |
| Color | Page `gray-50`, surface `white`, text `gray-900`, secondary text `gray-600`, border `gray-200`. Tailwind `primary` is blue-600 with blue-700 hover and a blue-50 tint. |
| Status | Green for success, amber for pending and in progress, red for errors and SOS, blue for open and information, gray for inactive states. |
| Typography | Inter. Page title 24/32 px on mobile and 30/36 px at `sm` and up. Section title 20/28 px, subsection and body 16/24 px, metadata and labels 14/20 px. |
| Spacing | `PageContainer` uses 16/24/32 px horizontal gutters, 24–32 px between sections, and a 1280 px max width by default. Use `width="form"` or `width="content"` for narrower pages. |
| Corners and depth | 8 px for controls, 12 px for cards, pill corners for badges and round avatars. Flat cards, subtle shadows for floating controls. |
| Interaction | Visible focus ring, readable disabled state, short color transitions, inline error text next to invalid fields. Use lucide icons with accessible labels for icon-only controls. |

Compose new and migrated screens with the primitives in `components/ui`. Pass
translated strings from `lib/i18n.ts` into components. For example, in a
registration screen where `t` is the active translator:

```tsx
<PageContainer width="form">
  <PageHeader title={t('auth.signup.title')} />
  <Card>
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <Input id="email" label={t('auth.signup.email')} type="email"
        autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Button type="submit" busy={isSubmitting}>{t('auth.signup.submit')}</Button>
    </form>
  </Card>
</PageContainer>
```

Use `Textarea` for multiline input, `SectionTitle` for an H2, `Badge` for a
short state label, and `EmptyState` when a list has no results. For a navigational
action, keep link semantics and apply `buttonClassName({ variant: 'secondary' })`
to the link. Use a regular `Button` when performing an action.

The base components use the existing shared CSS classes. Replace direct class
usage as each screen migrates. Remove legacy-only variants once no screen
uses them.

Prepared with Codex assistance.
