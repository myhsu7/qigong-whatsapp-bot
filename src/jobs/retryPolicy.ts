export const maxWebhookAttempts = 10;

export const webhookRetryDelaySeconds = (attemptCount: number) =>
    Math.min(3600, 30 * (2 ** Math.max(0, attemptCount - 1)));
