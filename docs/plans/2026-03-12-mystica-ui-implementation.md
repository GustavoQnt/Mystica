# Mystica UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the authenticated Mystica UI for home, reading flow, reading detail, and history in the approved Luxe Mystical direction.

**Architecture:** Use App Router pages plus a small set of client components for the interactive reading flow. Keep data access server-side where possible and use client-side fetch only for card draw and interpretation streaming.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, Supabase SSR client, Fetch streaming.

---

### Task 1: Establish the global visual system

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

### Task 2: Build shared UI primitives

**Files:**
- Create: `src/components/AppHeader.tsx`
- Create: `src/components/TodaysAdvice.tsx`
- Create: `src/components/CardFan.tsx`
- Create: `src/components/CardReveal.tsx`
- Create: `src/components/ReadingStream.tsx`

### Task 3: Build the home page

**Files:**
- Modify: `src/app/page.tsx`

### Task 4: Build the reading start page

**Files:**
- Create: `src/app/reading/page.tsx`

### Task 5: Build the reading detail page

**Files:**
- Create: `src/app/reading/[id]/page.tsx`

### Task 6: Build the history page

**Files:**
- Create: `src/app/history/page.tsx`

### Task 7: Verify

**Files:**
- None

- Run: `npm run lint`
- Run: `npm run build`
