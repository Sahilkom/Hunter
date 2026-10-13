import type { ResumeData } from "@/lib/types";

export function buildSampleResume(): ResumeData {
  return {
    id: "resume-sample",
    fullName: "Aanya Sharma",
    email: "aanya.sharma@email.com",
    phone: "+91 98765 43210",
    location: "Bangalore, India",
    links: ["https://github.com/aanya-dev", "https://linkedin.com/in/aanya-sharma"],
    summary:
      "Software engineer with internship experience building APIs and React apps. Strong in data structures, TypeScript, and collaborative product delivery. Seeking early-career Software Engineer roles in India.",
    skills: [
      "TypeScript",
      "JavaScript",
      "React",
      "Node.js",
      "Java",
      "Python",
      "SQL",
      "PostgreSQL",
      "Git",
      "REST APIs",
      "DSA",
      "Linux",
    ],
    experience: [
      {
        company: "Nimbus Labs",
        role: "Software Engineering Intern",
        start: "May 2025",
        end: "Aug 2025",
        bullets: [
          "Built REST endpoints in Node.js/TypeScript serving dashboard metrics for 8k weekly active users.",
          "Reduced p95 API latency by 22% by adding caching and trimming N+1 database queries.",
          "Partnered with design to ship a React settings flow with form validation and accessible error states.",
        ],
      },
      {
        company: "Campus Open Source Club",
        role: "Core Developer",
        start: "Aug 2024",
        end: "Present",
        bullets: [
          "Maintained a student event platform used by 1.2k campus users during fest season.",
          "Added CI checks and code review guidelines that cut regression bugs before release week.",
        ],
      },
    ],
    education: [
      {
        school: "National Institute of Technology",
        degree: "B.Tech, Computer Science",
        end: "2026",
        details: "CGPA 8.7/10 · Coursework: Algorithms, Databases, Operating Systems",
      },
    ],
    projects: [
      {
        name: "RouteBoard",
        summary: "Personal project tracking internship applications with filters and reminders.",
        bullets: [
          "Implemented Next.js UI with local persistence and status board views.",
          "Wrote parsing helpers to normalize job descriptions into searchable tags.",
        ],
        tech: ["Next.js", "TypeScript", "Tailwind"],
      },
      {
        name: "QueryLite",
        summary: "Lightweight SQL practice playground for interview prep.",
        bullets: [
          "Supported common SELECT/JOIN drills with instant feedback on sample datasets.",
        ],
        tech: ["Python", "SQLite", "Flask"],
      },
    ],
    rawText: "",
    fileName: "sample-resume.json",
    updatedAt: new Date().toISOString(),
  };
}
