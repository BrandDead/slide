#if WITH_DEV_AUTOMATION_TESTS

#include "DealtContractCodec.h"
#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FDealtEncounterFixtureTest,
    "DEALT.Showdown.Contracts.CanonicalEncounter",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDealtEncounterFixtureTest::RunTest(const FString& Parameters)
{
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Contracts/encounter.1208.v1.json"));
    FDealtEncounterPackage Encounter;
    FString Error;
    TestTrue(TEXT("Canonical encounter parses"), UDealtContractCodec::LoadEncounterFile(Path, Encounter, Error));
    TestEqual(TEXT("Schema version"), Encounter.SchemaVersion, 1);
    TestEqual(TEXT("Encounter ID"), Encounter.EncounterId, FString(TEXT("encounter-1208-las-olas-001")));
    TestTrue(TEXT("Crew is available"), Encounter.Crew.Num() >= 2);
    TestTrue(TEXT("Opposition is available"), Encounter.Opposition.Num() >= 1);
    TestTrue(TEXT("Terrain was flattened for native use"), Encounter.TerrainCells.Num() >= 9);
    TestEqual(TEXT("Objective kind"), Encounter.Objective.Kind, FString(TEXT("extract")));
    if (!Error.IsEmpty()) AddError(Error);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FDealtResultFixtureTest,
    "DEALT.Showdown.Contracts.CanonicalResultRoundTrip",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDealtResultFixtureTest::RunTest(const FString& Parameters)
{
    FString Json;
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Contracts/result.1208.v1.json"));
    TestTrue(TEXT("Canonical result file loads"), FFileHelper::LoadFileToString(Json, *Path));

    FDealtEncounterResult Result;
    FString Error;
    TestTrue(TEXT("Canonical result parses"), UDealtContractCodec::ParseResultJson(Json, Result, Error));
    TestFalse(TEXT("Idempotency key is present"), Result.IdempotencyKey.IsEmpty());

    FString RoundTripJson;
    TestTrue(TEXT("Parsed result serializes"), UDealtContractCodec::SerializeResultJson(Result, RoundTripJson, Error));
    FDealtEncounterResult RoundTrip;
    TestTrue(TEXT("Serialized result parses"), UDealtContractCodec::ParseResultJson(RoundTripJson, RoundTrip, Error));
    TestEqual(TEXT("Round-trip idempotency"), RoundTrip.IdempotencyKey, Result.IdempotencyKey);
    TestEqual(TEXT("Round-trip outcome"), static_cast<uint8>(RoundTrip.Outcome), static_cast<uint8>(Result.Outcome));
    if (!Error.IsEmpty()) AddError(Error);
    return true;
}

#endif
