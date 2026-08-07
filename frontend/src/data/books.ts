import atomicHabits from '../assets/covers/atomic-habits-591d57.png'
import projectHailMary from '../assets/covers/project-hail-mary-60c35e.png'
import normalPeople from '../assets/covers/normal-people-641378.png'
import theAlchemist from '../assets/covers/the-alchemist-761bdf.png'
import crawdads from '../assets/covers/where-the-crawdads-sing-641378.png'
import evelynHugo from '../assets/covers/evelyn-hugo-591d57.png'
import klara from '../assets/covers/klara-and-the-sun-641378.png'
import cryingHMart from '../assets/covers/crying-in-h-mart-591d57.png'
import songOfAchilles from '../assets/covers/the-song-of-achilles-591d57.png'
import circe from '../assets/covers/circe-3ea9d1.png'
import lessonsChemistry from '../assets/covers/lessons-in-chemistry-591d57.png'
import aLittleLife from '../assets/covers/a-little-life-641378.png'
import midnightLibrary from '../assets/covers/the-midnight-library-1b6823.png'
import dune from '../assets/covers/dune-41c1d5.png'

export const CATEGORIES = [
  'All Books',
  'Fiction',
  'Non-Fiction',
  'Tech',
  'Sci-Fi',
  'Self-Improvement',
  'Philosophy',
  'Business',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface Review {
  initials: string
  name: string
  meta: string
  rating: number
  text: string
  helpful: number
}

export interface Book {
  id: string
  title: string
  author: string
  price: number
  rating: number
  ratingCount?: number
  category: Category
  cover: string
  language?: string
  stock?: number
  synopsis?: string[]
  reviews?: Review[]
}

export const books: Book[] = [
  {
    id: 'atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    price: 16.2,
    rating: 4.8,
    category: 'Self-Improvement',
    cover: atomicHabits,
  },
  {
    id: 'project-hail-mary',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    price: 14.99,
    rating: 4.7,
    category: 'Sci-Fi',
    cover: projectHailMary,
  },
  {
    id: 'normal-people',
    title: 'Normal People',
    author: 'Sally Rooney',
    price: 12.5,
    rating: 4.4,
    category: 'Fiction',
    cover: normalPeople,
  },
  {
    id: 'the-alchemist',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    price: 10.99,
    rating: 4.6,
    category: 'Philosophy',
    cover: theAlchemist,
  },
  {
    id: 'where-the-crawdads-sing',
    title: 'Where the Crawdads Sing',
    author: 'Delia Owens',
    price: 15.0,
    rating: 4.5,
    category: 'Fiction',
    cover: crawdads,
  },
  {
    id: 'evelyn-hugo',
    title: 'The Seven Husbands of Evelyn Hugo',
    author: 'Taylor Jenkins Reid',
    price: 13.99,
    rating: 4.6,
    category: 'Fiction',
    cover: evelynHugo,
  },
  {
    id: 'klara-and-the-sun',
    title: 'Klara and the Sun',
    author: 'Kazuo Ishiguro',
    price: 17.5,
    rating: 4.3,
    category: 'Sci-Fi',
    cover: klara,
  },
  {
    id: 'crying-in-h-mart',
    title: 'Crying in H Mart',
    author: 'Michelle Zauner',
    price: 15.99,
    rating: 4.4,
    category: 'Non-Fiction',
    cover: cryingHMart,
  },
  {
    id: 'the-song-of-achilles',
    title: 'The Song of Achilles',
    author: 'Madeline Miller',
    price: 13.5,
    rating: 4.7,
    category: 'Fiction',
    cover: songOfAchilles,
  },
  {
    id: 'circe',
    title: 'Circe',
    author: 'Madeline Miller',
    price: 14.25,
    rating: 4.6,
    category: 'Fiction',
    cover: circe,
  },
  {
    id: 'lessons-in-chemistry',
    title: 'Lessons in Chemistry',
    author: 'Bonnie Garmus',
    price: 18.0,
    rating: 4.5,
    category: 'Fiction',
    cover: lessonsChemistry,
  },
  {
    id: 'a-little-life',
    title: 'A Little Life',
    author: 'Hanya Yanagihara',
    price: 19.99,
    rating: 4.2,
    category: 'Fiction',
    cover: aLittleLife,
  },
  {
    id: 'the-midnight-library',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    price: 18.5,
    rating: 4.8,
    ratingCount: 23,
    category: 'Fiction',
    cover: midnightLibrary,
    language: 'ENG',
    stock: 24,
    synopsis: [
      'Somewhere between life and death sits a library, and on its shelves wait the infinite lives you might have lived. Each book opens a door to a different choice, a different path — a chance to see how things could have unfolded.',
      'When Nora Seed steps inside, she is given the rare gift of undoing her regrets. As she moves from one possible life to the next, she must decide what it truly means to live, and what makes a single life worth choosing.',
    ],
    reviews: [
      {
        initials: 'ED',
        name: 'Eleanor Davis',
        meta: 'Verified Purchase • 2 weeks ago',
        rating: 5,
        text: 'This book changed my perspective on regret entirely. The concept of the library is beautifully realized — gentle yet profound.',
        helpful: 42,
      },
      {
        initials: 'MK',
        name: 'Marcus Kane',
        meta: '2 months ago',
        rating: 5,
        text: 'A deeply imaginative exploration of the lives we lead and the lives we do not. A must-read for anyone who has ever wondered "what if?"',
        helpful: 18,
      },
    ],
  },
  {
    id: 'dune',
    title: 'Dune',
    author: 'Frank Herbert',
    price: 23.99,
    rating: 4.7,
    category: 'Sci-Fi',
    cover: dune,
  },
]

export function getBook(id: string | undefined): Book | undefined {
  return books.find((b) => b.id === id)
}

export const formatPrice = (usd: number): string => `$${usd.toFixed(2)}`
