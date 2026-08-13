import class10 from "./class10.json";
import class12 from "./class12.json";
import jee from "./jee.json";
import neet from "./neet.json";
import type { SyllabusDataset } from "./types";
import type { ExamType } from "@/lib/schema";

export const SYLLABUS_BY_EXAM: Record<ExamType, SyllabusDataset> = {
  class10: class10 as SyllabusDataset,
  class12: class12 as SyllabusDataset,
  jeeMain: jee as SyllabusDataset,
  jeeAdvanced: jee as SyllabusDataset,
  neet: neet as SyllabusDataset,
};

export type { SyllabusDataset, SyllabusSubject, SyllabusChapter } from "./types";
