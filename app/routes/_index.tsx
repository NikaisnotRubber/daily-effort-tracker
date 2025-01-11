import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Response, json } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { db } from "~/utils/db.server";
import { requireUserId, logout } from "~/utils/auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Daily Effort Tracker" },
    { name: "description", content: "Track your daily effort scores" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  const scores = await db.effortScore.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 10,
    select: {
      id: true,
      date: true,
      score: true,
      description: true,
      timeSpent: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Calculate total score and average time
  const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
  const averageScore = scores.length > 0 ? (totalScore / scores.length).toFixed(1) : "0.0";
  
  const validTimes = scores.filter(score => score.timeSpent != null);
  const averageTime = validTimes.length > 0 
    ? (validTimes.reduce((sum, score) => sum + (score.timeSpent || 0), 0) / validTimes.length).toFixed(0)
    : "0";

  return json({ scores, totalScore, averageScore, averageTime });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "logout") {
    return logout(request);
  }

  if (intent === "delete") {
    const id = Number(form.get("id"));
    await db.effortScore.delete({
      where: { id }
    });
    return json({ success: true });
  }

  const score = Number(form.get("score"));
  const description = form.get("description") as string;
  const timeSpent = form.get("timeSpent") ? Number(form.get("timeSpent")) : null;
  const date = new Date();

  // Validate score range
  if (score < -10 || score > 10) {
    return json({ error: "分數必須在 -10 到 10 之間！" }, { status: 400 });
  }

  // Get current total score for this user
  const scores = await db.effortScore.findMany({
    where: { userId }
  });
  const currentTotal = scores.reduce((sum, s) => sum + s.score, 0);

  // Check if adding this score would make total negative
  if (currentTotal + score < 0) {
    return json({ error: "分數不夠，快去卷！" }, { status: 400 });
  }

  await db.effortScore.create({
    data: {
      score,
      description,
      timeSpent,
      date,
      userId
    }
  });

  return json({ success: true });
}

type EffortScore = {
  id: number;
  score: number;
  date: string;
  description: string | null;
  timeSpent: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function Index() {
  const { scores, totalScore, averageScore, averageTime } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [scoreInput, setScoreInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [timeSpentInput, setTimeSpentInput] = useState("");
  const [warning, setWarning] = useState("");

  // Reset fields when submission is successful
  useEffect(() => {
    if (actionData?.success) {
      setScoreInput("");
      setDescriptionInput("");
      setTimeSpentInput("");
      setWarning("");
    }
  }, [actionData]);

  // Client-side validation
  const handleScoreChange = (value: string) => {
    setScoreInput(value);
    const newScore = Number(value);
    
    // Validate score range
    if (newScore < -10 || newScore > 10) {
      setWarning("分數必須在 -10 到 10 之間！");
      return;
    }
    
    // Validate total score
    if (totalScore + newScore < 0) {
      setWarning("分數不夠，快去卷！");
    } else {
      setWarning("");
    }
    /*
    // Validate time spent
    if (Number(timeSpentInput) < 0) {
      setWarning("時間必須大於 0");
    } else {
      setWarning("");
    }
    */
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Daily Effort Tracker</h1>
        
        <Form method="post" className="mb-8 space-y-4">
          <div>
            <label htmlFor="score" className="block text-sm font-medium">
              Effort Score (-10 到 10)
            </label>
            <input
              type="number"
              name="score"
              id="score"
              value={scoreInput}
              onChange={(e) => handleScoreChange(e.target.value)}
              min="-10"
              max="10"
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100
                       focus:border-blue-500 focus:ring-blue-500
                       dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
            {warning && (
              <div className="mt-2 text-red-600 dark:text-red-400 text-sm font-medium">
                {warning}
              </div>
            )}
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              name="description"
              id="description"
              rows={3}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100
                       focus:border-blue-500 focus:ring-blue-500
                       dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="timeSpent" className="block text-sm font-medium">
              Time Spent (minutes)
            </label>
            <input
              type="number"
              name="timeSpent"
              id="timeSpent"
              value={timeSpentInput}
              onChange={(e) => setTimeSpentInput(e.target.value)}
              min="0"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100
                       focus:border-blue-500 focus:ring-blue-500
                       dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={warning !== ""}
            className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded-md 
                     hover:bg-blue-600 dark:hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     dark:focus:ring-offset-gray-900
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Record Effort
          </button>
        </Form>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Recent Scores</h2>
            <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalScore}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Average</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{averageScore}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Time</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{averageTime}m</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {scores.map((score: EffortScore) => (
              <div
                key={score.id}
                className="border dark:border-gray-700 rounded-lg p-4 
                         bg-white dark:bg-gray-800 
                         shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Score: {score.score}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(score.date).toLocaleDateString()}
                    </span>
                    {score.timeSpent && (
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        {score.timeSpent}m
                      </span>
                    )}
                    <Form method="post" className="inline">
                      <input type="hidden" name="id" value={score.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <button
                        type="submit"
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300
                                 focus:outline-none focus:underline"
                        title="Delete this record"
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
                {score.description && (
                  <p className="mt-2 text-gray-700 dark:text-gray-300">{score.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <Form method="post" className="inline">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300
                     focus:outline-none focus:underline"
            title="Logout"
          >
            Logout
          </button>
        </Form>
      </div>
    </div>
  );
}
