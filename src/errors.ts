export type UserInputErrorCode = 'select_method' | 'max_length' | 'invalid_method' | 'reminder_hour' | 'timezone' | 'invalid_month';

export class UserInputError extends Error {
    constructor(public readonly code: UserInputErrorCode) {
        super(code);
        this.name = 'UserInputError';
    }
}
