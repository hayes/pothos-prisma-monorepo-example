/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */
import { faker } from '@faker-js/faker';
import { PrismaClient } from '../dist';

const prisma = new PrismaClient();

faker.seed(123);

async function main() {
  for (let i = 1; i <= 10; i += 1) {
    const scores: { date: Date; score: string; name: string }[] = [];
    const values: { date: Date; value: string; scores: { create: typeof scores } }[] = [];

    const scoreNames = ['score1', 'score2', 'score3', 'score4', 'score5'];

    for (let j = 0; j < 100; j += 1) {
      scores.push({
        date: faker.date.past({ refDate: new Date(2021, 0, 1) }),
        score: faker.string.alpha(10),
        name: scoreNames[(Math.random() * scoreNames.length) | 0],
      });
    }

    for (let k = 0; k < 10; k += 1) {
      values.push({
        value: faker.string.alpha(10),
        date: faker.date.past({ refDate: new Date(2021, 0, 1) }),
        scores: {
          create: scores,
        },
      });
    }

    await prisma.account.create({
      data: {
        id: i,
        name: faker.person.firstName(),
        values: {
          create: values,
        },
      },
    });
  }
}

void main()
  .then(() => void console.log('DB seeded with test data'))
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(() => void prisma.$disconnect());
