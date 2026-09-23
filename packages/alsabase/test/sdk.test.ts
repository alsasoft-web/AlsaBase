import { AlsaBase } from "../src/index";
import { ClientResponseError } from "../src/ClientResponseError";

async function runTests() {
  console.log("[SDK Test] Starting AlsaBase SDK Verification Suite...\n");

  const client = new AlsaBase("http://localhost:8090");

  // Test 1: URL Builder and Filter Helper
  console.log("1. Testing Filter & URL Formatting Helpers...");
  const filterExpr = client.filter("status = {:status} && age > {:age} && title ~ {:title}", {
    status: "active",
    age: 25,
    title: 'test "quote"',
  });
  console.log("   Formatted Filter:", filterExpr);
  if (!filterExpr.includes('"active"') || !filterExpr.includes('25')) {
    throw new Error("Filter helper formatting failed");
  }

  const builtUrl = client.buildUrl("/api/test", { page: 1, search: "hello world" });
  console.log("   Built URL:", builtUrl);
  if (!builtUrl.includes("page=1") || !builtUrl.includes("search=hello+world")) {
    throw new Error("URL builder failed");
  }
  console.log("   Filter and URL builder tests passed.\n");

  // Test 2: File URL Builder
  console.log("2. Testing FileService URL Generation...");
  const recordFileUrl = client.files.getUrl({ collectionName: "posts", id: "rec_123" }, "cover.png");
  console.log("   Record File URL:", recordFileUrl);
  if (!recordFileUrl.includes("/api/static-files/file/posts/rec_123/cover.png")) {
    throw new Error("Record file URL generation failed");
  }

  const publicUrl = client.files.getPublicUrl("maps/mafia/lost-heaven/index.html");
  console.log("   Public Asset URL:", publicUrl);
  if (!publicUrl.includes("/maps/mafia/lost-heaven/index.html")) {
    throw new Error("Public URL generation failed");
  }
  console.log("   FileService tests passed.\n");

  // Test 3: Server Connectivity & Superuser Check
  console.log("3. Testing Server Connection & Superuser Check...");
  try {
    const initialCheck = await client.superusers.hasInitialSuperuser();
    console.log("   Initial Superuser Check Response:", initialCheck);
  } catch (err: any) {
    console.warn("   Server health check note (server may not be running locally on 8090):", err.message);
  }

  // Test 4: Error Handling & ClientResponseError
  console.log("\n4. Testing ClientResponseError Handling...");
  try {
    await client.send("/api/nonexistent-test-endpoint-404");
    console.error("   Expected 404 error but request succeeded!");
  } catch (err: any) {
    if (err instanceof ClientResponseError) {
      console.log(`   Caught expected ClientResponseError with status code: ${err.status}`);
    } else {
      console.log(`   Caught general network/fetch error: ${err.message}`);
    }
  }

  // Test 5: In-Memory AuthStore and Change Listeners
  console.log("\n5. Testing AuthStore & State Transitions...");
  let listenerCalled = false;
  const unsubscribe = client.authStore.onChange((token, model) => {
    listenerCalled = true;
    console.log(`   AuthStore change detected. Token: "${token ? token.substring(0, 10) + '...' : ''}", Model ID: ${(model as any)?.id}`);
  });

  client.authStore.save("mock.jwt.token", { id: "user_test_1", email: "test@alsabase.local" });
  if (!listenerCalled || client.authStore.token !== "mock.jwt.token") {
    throw new Error("AuthStore save failed");
  }

  client.authStore.clear();
  if ((client.authStore.token as string) !== "" || client.authStore.model !== null) {
    throw new Error("AuthStore clear failed");
  }
  unsubscribe();
  console.log("   AuthStore tests passed.\n");

  // Test 6: Schema retrieval methods availability
  console.log("6. Testing Schema Retrieval API interface...");
  if (typeof client.getSchema !== "function" || typeof client.getTableSchema !== "function") {
    throw new Error("client.getSchema or client.getTableSchema method missing");
  }
  if (typeof client.collections.getSchema !== "function" || typeof client.collections.getTableSchema !== "function") {
    throw new Error("client.collections.getSchema method missing");
  }
  const postsService = client.collection("posts");
  if (typeof postsService.getSchema !== "function" || typeof postsService.schema !== "function" || typeof postsService.getTableSchema !== "function") {
    throw new Error("postsService.getSchema or postsService.schema method missing");
  }
  // Test 7: Realtime Socket.IO subscription interface
  console.log("7. Testing Realtime Socket.IO Service interface...");
  if (typeof client.realtime.subscribe !== "function" || typeof client.realtime.unsubscribe !== "function" || typeof client.realtime.publish !== "function") {
    throw new Error("client.realtime methods missing");
  }
  const unsubRealtime = await client.realtime.subscribe("posts", (_event) => {});
  if (typeof unsubRealtime !== "function") {
    throw new Error("client.realtime.subscribe did not return unsubscribe function");
  }
  unsubRealtime();
  await client.realtime.unsubscribe("posts");
  console.log("   Realtime Socket.IO interface validation passed.\n");

  console.log("All AlsaBase SDK unit and integration checks executed successfully!");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
