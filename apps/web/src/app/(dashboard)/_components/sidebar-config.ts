// Routes where sidebar is locked in collapsed state
// - Sidebar starts collapsed
// - Toggle button is hidden
// - Rail (hover to expand) is hidden
export const lockedSidebarRoutes = [];

export const isLockedSidebarRoute = (pathname: string) => {
  return lockedSidebarRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
};
