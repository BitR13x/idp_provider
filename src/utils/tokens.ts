import { User } from "../database/entities/User";


export const jwtCreateAccessToken = (user: User, jwt: any): Promise<string> => {
    const payload = {
        sub: user.id,
        username: user.username,
        email: user.email
    };

    return jwt.sign(payload);
};
