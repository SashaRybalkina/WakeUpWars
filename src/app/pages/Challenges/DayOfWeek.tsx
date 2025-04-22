export enum DayOfWeek {
    M = 1,
    T,
    W,
    TH,
    F,
    S,
    SU,
  }
  
  export const DayOfWeekLabels: Record<DayOfWeek, string> = {
    [DayOfWeek.M]: "M",
    [DayOfWeek.T]: "T",
    [DayOfWeek.W]: "W",
    [DayOfWeek.TH]: "TH",
    [DayOfWeek.F]: "F",
    [DayOfWeek.S]: "S",
    [DayOfWeek.SU]: "SU",
  };
  
  export const LabelToDayOfWeek: Record<string, DayOfWeek> = {
    M: DayOfWeek.M,
    T: DayOfWeek.T,
    W: DayOfWeek.W,
    TH: DayOfWeek.TH,
    F: DayOfWeek.F,
    S: DayOfWeek.S,
    SU: DayOfWeek.SU,
  };