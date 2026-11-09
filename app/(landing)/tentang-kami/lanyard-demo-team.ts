import type { LanyardMember } from '@/app/components/landing/team-lanyard-rail';

// Data demo bawaan komponen team-lanyard-rail.
// Ganti dengan data tim asli sebelum halaman dipublikasikan.
export const LANYARD_DEMO_TEAM: LanyardMember[] = [
  {
    id: 'kayysan',
    name: 'Kayysan',
    role: 'Fullstack Developer',
    team: 'ReBites · Product',
    tone: 1,
    image:
      '/lanyard/kayysan.avif',
    qrSrc: '/lanyard/githubkayysan.avif',
    bio: 'Vocational student learning web development & programming. Building projects with passion',
    tags: ['Project manager'],
    links: [
      { label: 'Email', href: '#' },
      { label: 'Portfolio', href: '#' },
    ],
  },
  {
    id: 'falen',
    name: 'Faletehan',
    role: 'Backend Engineer ',
    team: 'ReBites · Platform',
    tone: 2,
    image:
      '/lanyard/falen.avif',
    qrSrc: '/lanyard/githubfalen.avif',
    bio: "Hi, I'm a Software Engineering (RPL) student at SMK Taruna Bhakti.",
    tags: ['Databaase', 'Backend', 'Ai'],
    links: [
      { label: 'Email', href: '#' },
      { label: 'Calendar', href: '#' },
    ],
  },
  {
    id: 'Jona',
    name: 'Jona',
    role: 'Frontend Engineer',
    team: 'ReBites · Design',
    tone: 3,
    image:
      '/lanyard/jona.avif',
    qrSrc: '/lanyard/githubjona.avif',
    bio: 'Front End Web Developer | UI/UX Designer | Digital Designer | "beginner"',
    tags: ['UI/UX', 'Design'],
    links: [
      { label: 'Email', href: '#' },
      { label: 'Notes', href: '#' },
    ],
  },
];
