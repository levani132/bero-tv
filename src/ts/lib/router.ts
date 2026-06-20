import { t } from "./i18n";

interface Route {
  path: string;
  component: Function;
  params?: any;
}

class Router {
  private oldRoutes: Route[] = [];
  private openRoute?: Route;
  private canExit: boolean = false;
  private rootElement?: HTMLElement;
  private routes: Record<string, Route> = {};

  setup(element: HTMLElement) {
    this.rootElement = element;
  }

  goTo(route: string, params?: any, reopen: boolean = false) {
    this.canExit = false;
    this.go(route, params, reopen, false);
  }

  replacePage(route: string, params?: any, reopen: boolean = false) {
    this.canExit = false;
    this.go(route, params, reopen, true);
  }

  goBack() {
    if (this.oldRoutes.length) {
      const oldRoute = this.oldRoutes.pop() as Route;
      this.replacePage(oldRoute.path, oldRoute.params);
    } else if (this.canExit) {
      this.closeRoute();
      if (window["Android"]) Android.exit();
      else if (window["tizen"]) tizen.application.getCurrentApplication().exit();
    } else {
      this.canExit = true;
      if (window["Android"]) Android.showToast(t("retry"));
    }
  }

  getCurrentRoute() {
    return this.openRoute?.path;
  }

  registerRoute(path: string, component: Function) {
    this.routes[path] = { path, component };
  }

  private go(route: string, params: any, reopen: boolean, replace: boolean) {
    if (this.openRoute?.path === route && !reopen) return;
    this.closeRoute();
    if (!replace && this.openRoute) this.oldRoutes.push(this.openRoute);
    const routeComponent = this.routes[route].component;
    this.openRoute = { path: route, component: routeComponent, params };
    if (this.rootElement) this.rootElement.innerHTML = routeComponent(params);
    // @ts-ignore — pages expose an optional static mount()
    routeComponent.mount?.();
  }

  private closeRoute() {
    // @ts-ignore — pages expose an optional static destructor()
    this.openRoute?.component.destructor?.();
  }
}

export const router = new Router();
