// Phone-only fixes for every admin page (the owner runs the admin from a phone). Scoped to the
// `.ohp-admin` wrapper AdminShell puts around the page, and to phone widths only - desktop is
// untouched.
//
// - Text boxes and dropdowns at 16px: iPhone Safari zooms the whole page in when you tap a field
//   whose text is smaller than that, and the page stays zoomed - headers and buttons end up cut
//   off at the edges.
const CSS = `
@media (max-width: 639px) {
  .ohp-admin :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]), select, textarea) { font-size: 16px !important; }
}
`

export default function AdminMobileStyles() {
  return <style>{CSS}</style>
}
