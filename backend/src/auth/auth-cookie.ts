import type { Request } from 'express';

export function cookie(req: Request, name: string): string | undefined {
  return req.headers.cookie?.split(';').map(item => item.trim())
    .find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}
