import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '../../../cli/src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

// Determine API URL based on environment
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In browser, use same origin
    return '';
  }
  return 'http://localhost:3000';
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});
