/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agents from "../agents.js";
import type * as businessContext from "../businessContext.js";
import type * as channels from "../channels.js";
import type * as documents from "../documents.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as routines from "../routines.js";
import type * as settings from "../settings.js";
import type * as tasks from "../tasks.js";
import type * as types from "../types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agents: typeof agents;
  businessContext: typeof businessContext;
  channels: typeof channels;
  documents: typeof documents;
  messages: typeof messages;
  notifications: typeof notifications;
  routines: typeof routines;
  settings: typeof settings;
  tasks: typeof tasks;
  types: typeof types;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
