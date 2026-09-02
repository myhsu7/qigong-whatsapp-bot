import crypto from 'crypto';

export const computeMetaSignature = (rawBody: Buffer, appSecret: string) =>
    `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

export const verifyMetaSignature = (rawBody: Buffer, signature: string | undefined, appSecret: string) => {
    if (!signature || !appSecret) return false;
    const expected = computeMetaSignature(rawBody, appSecret);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};
