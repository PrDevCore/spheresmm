import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import { SocialAccount, Post, AnalyticSnapshot } from "../types";

function getLocalAccounts(userId: string): SocialAccount[] {
  try {
    const data = localStorage.getItem(`smm_accounts_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse local accounts", e);
    return [];
  }
}

function setLocalAccounts(userId: string, accounts: SocialAccount[]) {
  try {
    localStorage.setItem(`smm_accounts_${userId}`, JSON.stringify(accounts));
  } catch (e) {
    console.error("Failed to save local accounts", e);
  }
}

function getLocalPosts(userId: string): Post[] {
  try {
    const data = localStorage.getItem(`smm_posts_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse local posts", e);
    return [];
  }
}

function setLocalPosts(userId: string, posts: Post[]) {
  try {
    localStorage.setItem(`smm_posts_${userId}`, JSON.stringify(posts));
  } catch (e) {
    console.error("Failed to save local posts", e);
  }
}

function getLocalAnalytics(userId: string): AnalyticSnapshot[] {
  try {
    const data = localStorage.getItem(`smm_analytics_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse local analytics", e);
    return [];
  }
}

function setLocalAnalytics(userId: string, analytics: AnalyticSnapshot[]) {
  try {
    localStorage.setItem(`smm_analytics_${userId}`, JSON.stringify(analytics));
  } catch (e) {
    console.error("Failed to save local analytics", e);
  }
}

export async function getSocialAccounts(userId: string): Promise<SocialAccount[]> {
  try {
    const q = query(collection(db, "socialAccounts"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const accounts: SocialAccount[] = [];
    snap.forEach((d) => {
      const data = d.data() as SocialAccount;
      accounts.push({ ...data, id: d.id });
    });

    if (accounts.length > 0) {
      setLocalAccounts(userId, accounts);
      return accounts;
    }
  } catch (err) {
    console.warn("Firestore social accounts fetch failed, falling back to LocalStorage.", err);
  }

  return getLocalAccounts(userId);
}

export async function getPosts(userId: string): Promise<Post[]> {
  try {
    const q = query(collection(db, "posts"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const posts: Post[] = [];
    snap.forEach((d) => {
      const data = d.data() as Post;
      posts.push({ ...data, id: d.id });
    });

    const sorted = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sorted.length > 0) {
      setLocalPosts(userId, sorted);
      return sorted;
    }
  } catch (err) {
    console.warn("Firestore posts fetch failed, falling back to LocalStorage.", err);
  }

  return getLocalPosts(userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAnalytics(userId: string): Promise<AnalyticSnapshot[]> {
  try {
    const q = query(collection(db, "analytics"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const data: AnalyticSnapshot[] = [];
    snap.forEach((d) => {
      const snapData = d.data() as AnalyticSnapshot;
      data.push({ ...snapData, id: d.id });
    });

    if (data.length > 0) {
      setLocalAnalytics(userId, data);
      return data;
    }
  } catch (err) {
    console.warn("Firestore analytics fetch failed, falling back to LocalStorage.", err);
  }

  return getLocalAnalytics(userId);
}

export async function createPost(postData: Omit<Post, "id">): Promise<Post> {
  const id = `post_${crypto.randomUUID()}`;
  const newPost: Post = { ...postData, id };

  const localPosts = getLocalPosts(postData.userId);
  localPosts.unshift(newPost);
  setLocalPosts(postData.userId, localPosts);

  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "posts"), id), newPost);
    await batch.commit();
  } catch (err) {
    console.warn("Firestore create post failed, saved to LocalStorage only.", err);
  }

  return newPost;
}

export async function updatePost(postId: string, updates: Partial<Post>): Promise<void> {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("smm_posts_")) {
      const posts: Post[] = JSON.parse(localStorage.getItem(key) || "[]");
      const idx = posts.findIndex((p) => p.id === postId);
      if (idx !== -1) {
        posts[idx] = { ...posts[idx], ...updates };
        localStorage.setItem(key, JSON.stringify(posts));
        break;
      }
    }
  }

  try {
    await updateDoc(doc(db, "posts", postId), updates);
  } catch (err) {
    console.warn("Firestore update post failed, saved to LocalStorage only.", err);
  }
}

export async function deletePost(postId: string): Promise<void> {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("smm_posts_")) {
      const posts: Post[] = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify(posts.filter((p) => p.id !== postId)));
      break;
    }
  }

  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (err) {
    console.warn("Firestore delete post failed, saved to LocalStorage only.", err);
  }
}

export async function connectSocialAccount(accountData: Omit<SocialAccount, "id">): Promise<SocialAccount> {
  const id = `account_${crypto.randomUUID()}`;
  const newAccount: SocialAccount = { ...accountData, id };

  const localAccounts = getLocalAccounts(accountData.userId);
  localAccounts.push(newAccount);
  setLocalAccounts(accountData.userId, localAccounts);

  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "socialAccounts"), id), newAccount);
    await batch.commit();
  } catch (err) {
    console.warn("Firestore connect account failed, saved to LocalStorage only.", err);
  }

  return newAccount;
}

export async function disconnectSocialAccount(accountId: string, userId: string): Promise<void> {
  const localAccounts = getLocalAccounts(userId);
  setLocalAccounts(userId, localAccounts.filter((a) => a.id !== accountId));

  try {
    await deleteDoc(doc(db, "socialAccounts", accountId));
  } catch (err) {
    console.warn("Firestore disconnect account failed, saved to LocalStorage only.", err);
  }
}
