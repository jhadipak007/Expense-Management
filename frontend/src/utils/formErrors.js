/** Validation and error messages shared by the app's forms. */

/** A positive amount with at most 2 decimal places, as the API accepts it. */
export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const UNAVAILABLE = 'Something went wrong. Please try again.';
export const CHECK_FORM = 'Please check the form and try again.';

/** True if `amount` (a string) is greater than 0 with at most 2 decimal places. */
export function isValidAmount(amount) {
  return AMOUNT_PATTERN.test(amount) && Number(amount) > 0;
}

/** A 422 response's field errors, using the form's own message for each field it knows. */
export function serverFieldErrors(body, messages) {
  const errors = {};
  for (const { loc } of body?.detail ?? []) {
    const field = loc?.[1];
    if (messages[field]) errors[field] = messages[field];
  }
  return errors;
}
