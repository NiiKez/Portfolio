export type ActionResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export function actionSuccess<T>(data: T): ActionResponse<T> {
  return { success: true, data };
}

export function actionError(error: string): ActionResponse<never> {
  return { success: false, error };
}
