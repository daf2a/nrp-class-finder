export interface Participant {
  nrp: string;
  name: string;
  course_name: string;
}

export interface ClassResult {
  mk_id: string;
  semester: number;
  kelas: string;
  name: string;
  course_name: string;
}

export interface SearchResponse {
  results: ClassResult[];
  error?: string;
}
