# Mise

**Mise** is a small cooking companion built around one question:

> **What can I cook with what I already have?**

Instead of starting from a recipe and then buying half a supermarket, Mise starts with your real kitchen stock. It keeps track of what you have, helps you build a smarter shopping list, saves recipes you actually want to make again, and generates a cooking brief you can paste into an AI assistant for meal ideas based on your current ingredients.

**Try it here:** [anjomort0.github.io/cooking_prompt_generator](https://anjomort0.github.io/cooking_prompt_generator/)

---

## What it does

### Keep track of your stock

Add the ingredients you already have at home and keep track of quantity, unit, category, and state such as **open**, **frozen**, **low**, or **out**.

You can edit ingredients later, move things onto your shopping list, and quickly see what is actually available before deciding what to cook.

### Build a smarter shopping list

Mise has a normal shopping list, but it also learns from your local usage and can surface useful suggestions.

When generating a cooking brief, it can recommend **0–3 carefully chosen ingredients** that would unlock the largest number and variety of additional meals using the stock you already have.

The goal is not to tell you to buy everything a recipe is missing — it is to identify the smallest number of useful additions that make your kitchen more flexible.

### Save recipes you want to keep

Paste a generated recipe, or any recipe with a clear ingredients section, into the recipe library.

Mise compares it with your current stock and remembers which ingredients appear in the recipes you actually save, helping future suggestions become more relevant to the way you cook.

### Generate a cooking brief

The **Cook** section turns your current stock, kitchen setup, preferences, and local history into a ready-to-use AI prompt.

It asks for:

- several genuinely different meals you can cook now
- realistic use of the ingredients you already have
- minimal additional shopping
- an optional **prep-ahead recipe** when your stock suits something that benefits from marinating, brining, soaking, proofing, pickling, fermenting, curing, or another long rest
- up to **three high-impact shopping suggestions** that unlock the most extra recipes

That means you might choose dinner for tonight while also noticing that you could start tomorrow's meal now.

---

## How to use Mise

1. Open **Stock** and add what is currently in your kitchen.
2. Update quantities and mark ingredients as open, frozen, low, or out when needed.
3. Use **Shopping** for things you need to buy and check the smart suggestions if you want ideas.
4. Open **Cook**, choose the kind of meal you feel like eating, and copy the generated cooking brief into your preferred AI assistant.
5. Save recipes you like into **Recipes** so Mise can gradually learn what ingredients matter most to you.
6. Repeat as your kitchen changes.

Everything is intentionally lightweight: there is no account to create and no complicated setup before you can start using it.

---

## Your data

Mise is designed around local-first use. Your stock, shopping list, recipe library, and usage history are stored in your browser rather than in a Mise account or remote database.

The cooking brief is generated locally from that information. Nothing is sent to an AI service until **you choose to copy the prompt and paste it into one yourself**.

---

## AI transparency

This is a **fully vibe-coded project**.

The application was created iteratively with AI coding assistance rather than through a traditional hand-written development process. AI has been used extensively for implementation, debugging, UI iteration, copy, and feature development throughout the project.

The project is deliberately open about that. The aim is to explore what can be built through conversational, AI-assisted software creation while still producing something useful enough to use day to day.

AI-generated code can contain mistakes. The app is continuously tested, adjusted, and refined as those issues are found.

---

## Why "Mise"?

The name comes from **mise en place** — the habit of getting everything in place before cooking.

Mise applies the same idea one step earlier: know what is already in your kitchen, make better use of it, and decide what is worth preparing next.

---

Built as an experiment in practical home cooking and fully AI-assisted vibe coding.

[View the repository](https://github.com/AnJoMort0/cooking_prompt_generator) · [Open Mise](https://anjomort0.github.io/cooking_prompt_generator/)
