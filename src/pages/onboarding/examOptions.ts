import type { ExamType, SchoolLevel } from "@/lib/schema";

export interface ExamOption {
  /** Unique selection key — class ranges share `type` ("class10") but must be
   *  individually selectable. */
  key: string;
  type: ExamType;
  label: string;
  sublabel: string;
  accent: "jee" | "neet" | "boards";
  /** Sensible default exam date to prefill — students can change it. */
  defaultDate: string; // YYYY-MM-DD
  /** Groups the exam in the onboarding picker. */
  group: "school" | "competitive";
  /** Academic tier; drives age-appropriate feature defaults + syllabus seeding. */
  level: SchoolLevel;
}

export const EXAM_OPTIONS: ExamOption[] = [
  {
    key: "class1-5",
    type: "class10",
    label: "Class 1 – 5",
    sublabel: "Primary school",
    accent: "boards",
    defaultDate: "2027-03-01",
    group: "school",
    level: "primary",
  },
  {
    key: "class6-8",
    type: "class10",
    label: "Class 6 – 8",
    sublabel: "Middle school",
    accent: "boards",
    defaultDate: "2027-03-01",
    group: "school",
    level: "middle",
  },
  {
    key: "class9-10",
    type: "class10",
    label: "Class 9 – 10",
    sublabel: "CBSE / State Board",
    accent: "boards",
    defaultDate: "2027-03-01",
    group: "school",
    level: "secondary",
  },
  {
    key: "class11-12",
    type: "class12",
    label: "Class 11 – 12",
    sublabel: "CBSE / State Board",
    accent: "boards",
    defaultDate: "2027-03-01",
    group: "school",
    level: "senior",
  },
  {
    key: "jeeMain",
    type: "jeeMain",
    label: "JEE Main",
    sublabel: "Engineering entrance",
    accent: "jee",
    defaultDate: "2027-01-24",
    group: "competitive",
    level: "senior",
  },
  {
    key: "jeeAdvanced",
    type: "jeeAdvanced",
    label: "JEE Advanced",
    sublabel: "IIT entrance",
    accent: "jee",
    defaultDate: "2027-05-23",
    group: "competitive",
    level: "senior",
  },
  {
    key: "neet",
    type: "neet",
    label: "NEET",
    sublabel: "Medical entrance",
    accent: "neet",
    defaultDate: "2027-05-03",
    group: "competitive",
    level: "senior",
  },
];

export const EXAM_GROUP_LABEL: Record<ExamOption["group"], string> = {
  school: "School",
  competitive: "Competitive exams",
};

