import { createServer } from 'http';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtilsPlugin from '@pothos/plugin-prisma-utils';
import RelayPlugin from '@pothos/plugin-relay';
import { PrismaClient } from '@example/prisma';
import type PrismaTypes from '@example/prisma/pothos-types';
import { DateResolver } from 'graphql-scalars';

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
// notice in the logs that the params are the same, even though the args are different
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
});

prisma.$use((params, next) => {
  console.dir(params, { depth: 10 });

  return next(params);
});

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    Date: { Input: Date; Output: Date };
    ID: { Input: string; Output: string | number };
  };
}>({
  relayOptions: {
    cursorType: 'String',
    clientMutationId: 'omit',
  },
  prisma: {
    client: prisma,
  },
  plugins: [PrismaPlugin, RelayPlugin, PrismaUtilsPlugin],
});

builder.addScalarType('Date', DateResolver, {});

builder.queryType({
  fields: (t) => ({
    account: t.prismaField({
      type: 'Account',
      args: {
        id: t.arg.id({ required: true }),
      },
      nullable: true,
      resolve: (query, root, args) => {
        return prisma.account.findUnique({ ...query, where: { id: Number.parseInt(args.id, 10) } });
      },
    }),
  }),
});

const DateFilter = builder.prismaFilter('Date', {
  ops: ['gte', 'lte', 'equals'],
});

const AccountValuesFilter = builder.prismaWhere('Value', {
  fields: (t) => ({
    date: DateFilter,
  }),
});

const ValuesScoreFilter = builder.prismaWhere('Score', {
  fields: (t) => ({
    date: DateFilter,
  }),
});

builder.prismaObject('Account', {
  name: 'Property',
  fields: (t) => ({
    id: t.exposeID('id'),
    values: t.relatedConnection('values', {
      cursor: 'id',
      totalCount: true,
      defaultSize: 10000,
      args: {
        filter: t.arg({ type: AccountValuesFilter }),
      },
      query: (args) => {
        return {
          where: args.filter ?? {},
        };
      },
    }),
  }),
});

builder.prismaObject('Value', {
  fields: (t) => ({
    id: t.exposeID('id'),
    value: t.exposeString('value'),
    date: t.expose('date', {
      type: 'Date',
    }),
    scoreDate: t.field({
      type: 'Date',
      nullable: true,
      args: {
        filter: t.arg({ type: ValuesScoreFilter }),
      },
      select: (args) => ({
        scores: {
          select: {
            date: true,
          },
          orderBy: { score: 'asc' },
          take: 1,
          where: {
            ...(args.filter ?? {}),
            name: 'score1',
          },
        },
      }),
      resolve: ({ scores }) => {
        return scores?.[0]?.date;
      },
    }),
    score: t.string({
      nullable: true,
      args: {
        filter: t.arg({ type: ValuesScoreFilter }),
      },
      select: (args) => ({
        scores: {
          select: {
            id: true,
            score: true,
          },
          orderBy: { score: 'desc' },
          take: 1,
          where: {
            ...(args.filter ?? {}),
            name: 'score3',
          },
        },
      }),
      resolve: ({ scores }) => {
        return scores?.[0]?.score;
      },
    }),
  }),
});

const schema = builder.toSchema({});

const query = /* graphql */ `
  query {
    account(id: 1) {
      values {
        edges {
          node {
            id
            value
            date
            currentScore: score(filter: { date: { equals: "2020-04-27" } })
            previousScore: score(filter: { date: { equals: "2019-04-27" } })
            currentScoreDate:scoreDate(filter: { date: { lte: "2020-07-30" } })
            previousScoreDate:scoreDate(filter: { date: { lte: "2019-07-30" } })
          }
        }
      }
    }
  }
`;

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: query,
  },
});

const server = createServer(yoga);

const port = 4000;

server.listen(port, () => console.log(`Server is running on http://localhost:${port}/graphql`));
