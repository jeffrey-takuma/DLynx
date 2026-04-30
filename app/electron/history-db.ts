import path from "node:path";
import * as NedbModule from "@seald-io/nedb";
import { app } from "electron";

export type HistoryItem = {
  _id?: string;
  title: string;
  url: string;
  filePath: string;
  savedAt: string;
};

export type NewHistoryItem = Omit<HistoryItem, "_id">;
export type SavedHistoryItem = NewHistoryItem & { _id: string };

type HistoryCursor = {
  sort(query: { savedAt: 1 | -1 }): {
    limit(count: number): {
      execAsync(): Promise<SavedHistoryItem[]>;
    };
  };
};

type HistoryDatastore = {
  insertAsync(item: NewHistoryItem): Promise<SavedHistoryItem>;
  findAsync(query: Record<string, never>): HistoryCursor;
};

type DatastoreConstructor = new (options: {
  autoload: boolean;
  filename: string;
}) => HistoryDatastore;

const Datastore = (NedbModule.default ??
  NedbModule) as unknown as DatastoreConstructor;

let historyDb: HistoryDatastore | undefined;

function getHistoryDb(): HistoryDatastore {
  historyDb ??= new Datastore({
    filename: path.join(app.getPath("userData"), "history.db"),
    autoload: true,
  });

  return historyDb;
}

export function addHistoryItem(
  item: NewHistoryItem,
): Promise<SavedHistoryItem> {
  return getHistoryDb().insertAsync(item);
}

export function listHistoryItems(): Promise<SavedHistoryItem[]> {
  return getHistoryDb()
    .findAsync({})
    .sort({ savedAt: -1 })
    .limit(50)
    .execAsync();
}
