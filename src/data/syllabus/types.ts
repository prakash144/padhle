export interface SyllabusChapter {
  name: string;
  /** Rough exam-weightage 1-10, used for "high-weight, low-mastery" nudges later. */
  weightage: number;
}

export interface SyllabusSubject {
  name: string;
  color: string;
  chapters: SyllabusChapter[];
}

export type SyllabusDataset = SyllabusSubject[];
