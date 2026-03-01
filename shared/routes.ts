import { z } from 'zod';
import { insertWalletSchema, wallets, transactions, taxReports, insertTaxReportSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  wallets: {
    list: {
      method: 'GET' as const,
      path: '/api/wallets' as const,
      responses: {
        200: z.array(z.custom<typeof wallets.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/wallets' as const,
      input: insertWalletSchema,
      responses: {
        201: z.custom<typeof wallets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    sync: {
      method: 'POST' as const,
      path: '/api/wallets/:id/sync' as const,
      responses: {
        200: z.object({ success: z.boolean(), count: z.number() }),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/wallets/:id' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      }
    }
  },
  intercom: {
    send: {
      method: 'POST' as const,
      path: '/api/intercom' as const,
      input: z.object({ content: z.string() }),
      responses: {
        200: z.object({ reply: z.string() }),
      }
    },
    list: {
      method: 'GET' as const,
      path: '/api/intercom' as const,
      responses: {
        200: z.array(z.object({ id: z.number(), content: z.string(), sender: z.string(), timestamp: z.string() })),
      }
    }
  },
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions' as const,
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    }
  },
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/reports' as const,
      responses: {
        200: z.array(z.custom<typeof taxReports.$inferSelect>()),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/reports/:id' as const,
      responses: {
        200: z.custom<typeof taxReports.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    generate: {
      method: 'POST' as const,
      path: '/api/reports' as const,
      input: z.object({
        country: z.string(),
        taxYear: z.number(),
        period: z.string()
      }),
      responses: {
        201: z.custom<typeof taxReports.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
