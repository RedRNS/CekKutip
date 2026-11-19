/**
 * The CekKutip server this build talks to. The build script fills it in (default: the live site's
 * address from site.config.ts; set CEKKUTIP_URL to point a build at another server).
 */
declare const __SITE_URL__: string
export const SITE_URL: string = __SITE_URL__
