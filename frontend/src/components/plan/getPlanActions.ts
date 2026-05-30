/** Workflow status for business plans. */
export type PlanStatus = "DRAFT" | "UNDER_REVIEW" | "ADJUSTMENT" | "VALIDATED";

/** Role used for action visibility (admin follows expert rules). */
export type PlanRole = "client" | "expert";

export type PlanActionId =
  | "save"
  | "submit_for_review"
  | "approve"
  | "request_adjustment"
  | "edit"
  | "resubmit"
  | "export_pdf"
  | "export_xlsx";

export type PlanActions = {
  primary: PlanActionId | null;
  secondary: PlanActionId[];
  exports: PlanActionId[];
};

const EMPTY: PlanActions = { primary: null, secondary: [], exports: [] };

/**
 * Returns which actions to show for a given workflow state and role.
 * DRAFT → UNDER_REVIEW → ADJUSTMENT → VALIDATED
 */
export function getActions(status: PlanStatus, role: PlanRole): PlanActions {
  if (role === "expert") {
    if (status === "UNDER_REVIEW") {
      return {
        primary: "approve",
        secondary: ["request_adjustment"],
        exports: [],
      };
    }
    if (status === "VALIDATED") {
      return {
        primary: null,
        secondary: [],
        exports: ["export_pdf", "export_xlsx"],
      };
    }
    return EMPTY;
  }

  // client
  if (status === "DRAFT") {
    return {
      primary: "submit_for_review",
      secondary: ["save"],
      exports: [],
    };
  }
  if (status === "ADJUSTMENT") {
    return {
      primary: "resubmit",
      secondary: ["edit"],
      exports: [],
    };
  }
  if (status === "VALIDATED") {
    return {
      primary: null,
      secondary: [],
      exports: ["export_pdf", "export_xlsx"],
    };
  }

  // UNDER_REVIEW: client is read-only — no actions
  return EMPTY;
}

export function hasVisibleActions(actions: PlanActions): boolean {
  return Boolean(
    actions.primary || actions.secondary.length > 0 || actions.exports.length > 0
  );
}

/** Map JWT role to workflow role (admin uses expert actions). */
export function planRoleFromUser(role: string | undefined): PlanRole {
  return role === "expert" || role === "admin" ? "expert" : "client";
}

/** @deprecated Use `planRoleFromUser(user?.role)` */
export function planRoleFromAuth(isExpert: boolean, isAdmin: boolean): PlanRole {
  return isExpert || isAdmin ? "expert" : "client";
}
