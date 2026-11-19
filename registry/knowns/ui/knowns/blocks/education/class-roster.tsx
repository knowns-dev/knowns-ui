"use client";
/** @registry name="class-roster" type="block" title="Class roster" description="The teacher's list of students: search, today's attendance as a chip that cycles Present, Late, Absent and Excused, the average so far and when each student was last active. Built on the data table, driven by props, no backend." */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Badge, type BadgeTone } from "../../badge";
import { AvatarLabel } from "../../avatar";
import { Button } from "../../button";
import { DataTable, type DataColumn } from "../../data-table/data-table";
import { ago, attendanceCounts, ATTENDANCE_LABEL, formatPercent, nextAttendance, type Attendance, type ClassStudent } from "./class-core";

export type RosterStudent = ClassStudent & {
  /** When the student last did anything, in ms since the epoch. */
  lastActiveMs?: number;
  /** The class average so far, 0 to 100. Leave out for a dash. */
  average?: number | null;
};

export interface ClassRosterProps {
  students: readonly RosterStudent[];
  /** Today's status by student id. A student with none is not marked yet. */
  attendance: Record<string, Attendance | undefined>;
  /** Fired when the status chip is pressed, with the next status in the cycle. */
  onAttendanceChange?: (studentId: string, next: Attendance) => void;
  /** Fired when a row is clicked, for opening the student. */
  onSelectStudent?: (studentId: string) => void;
  /** Mark everyone who is not marked yet as present. Shows a button when given. */
  onMarkAllPresent?: () => void;
  /** "Now" for the last-active column, in ms. Default: the real time once mounted. */
  now?: number;
  title?: string;
  /** Rows per page, or false for one list. Default false: a class fits one scrolling list. */
  pageSize?: number | false;
  className?: string;
}

const TONE: Record<Attendance, BadgeTone> = { present: "success", late: "warning", absent: "danger", excused: "info" };

/** The roster of one class. */
export function ClassRoster({ students, attendance, onAttendanceChange, onSelectStudent, onMarkAllPresent, now, title = "Class roster", pageSize = false, className }: ClassRosterProps) {
  const newest = useMemo(() => students.reduce((m, s) => Math.max(m, s.lastActiveMs ?? 0), 0), [students]);
  const [clock, setClock] = useState(newest);
  useEffect(() => setClock(Date.now()), []);
  const at = now ?? clock;
  const counts = attendanceCounts(students, attendance);

  const columns: DataColumn<RosterStudent>[] = [
    {
      id: "name",
      header: "Student",
      accessor: "name",
      sortable: true,
      cell: (s) => <AvatarLabel label={s.name} description={s.email} size="sm" />,
    },
    {
      id: "attendance",
      header: "Today",
      accessor: (s) => ATTENDANCE_LABEL[attendance[s.id] ?? "absent"] + (attendance[s.id] ? "" : " unmarked"),
      sortable: true,
      cell: (s) => {
        const a = attendance[s.id];
        return (
          <Badge
            tone={a ? TONE[a] : "neutral"}
            variant={a ? "soft" : "outline"}
            dot
            size="sm"
            onClick={onAttendanceChange ? (e) => (e.stopPropagation(), onAttendanceChange(s.id, nextAttendance(a))) : undefined}
            aria-label={`${s.name}: ${a ? ATTENDANCE_LABEL[a] : "not marked"}${onAttendanceChange ? `. Press for ${ATTENDANCE_LABEL[nextAttendance(a)]}` : ""}`}
          >
            {a ? ATTENDANCE_LABEL[a] : "Not marked"}
          </Badge>
        );
      },
    },
    { id: "average", header: "Average", align: "end", accessor: (s) => s.average ?? -1, sortable: true, cell: (s) => <span className="tabular-nums">{formatPercent(s.average)}</span>, filterable: false },
    { id: "last", header: "Last active", accessor: (s) => s.lastActiveMs ?? 0, sortable: true, cell: (s) => <span className="text-muted-foreground">{ago(s.lastActiveMs, at)}</span>, filterable: false },
  ];

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <p aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{counts.inRoom}</span> of <span className="tabular-nums">{students.length}</span> in the room
          {counts.late > 0 && <span className="tabular-nums">, {counts.late} late</span>}
          {counts.unmarked > 0 && <span className="tabular-nums">, {counts.unmarked} not marked</span>}
        </span>
      </p>
      <DataTable<RosterStudent>
        title={title}
        titleAs="h3"
        rows={[...students]}
        columns={columns}
        getRowId={(s) => s.id}
        pageSize={pageSize}
        maxHeight={420}
        controls={false}
        defaultDensity="default"
        onRowClick={onSelectStudent ? (s) => onSelectStudent(s.id) : undefined}
        empty="No students in this class yet."
        toolbar={
          onMarkAllPresent && counts.unmarked > 0 ? (
            <Button variant="secondary" size="sm" onClick={onMarkAllPresent}>
              Mark all present
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export default ClassRoster;
