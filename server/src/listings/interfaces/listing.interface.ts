export interface Listing {
  title: string;
  url: string | null;
  price: number | null;
  rooms: number | null;
  area: number | null;
  rent: number | null;
  deposit: number | null;
  address: string | null;
  description: string | null;
  addedAt?: string | null;
}