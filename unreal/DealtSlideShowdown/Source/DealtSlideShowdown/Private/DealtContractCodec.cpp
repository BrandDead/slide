#include "DealtContractCodec.h"

#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace DealtContract
{
    bool ReadGridPoint(const TSharedPtr<FJsonObject>& Object, FDealtGridPoint& OutPoint)
    {
        if (!Object.IsValid()) return false;
        OutPoint.X = Object->GetIntegerField(TEXT("x"));
        OutPoint.Y = Object->GetIntegerField(TEXT("y"));
        return true;
    }

    EDealtTeam ReadTeam(const FString& Value)
    {
        return Value.Equals(TEXT("opposition"), ESearchCase::IgnoreCase) ? EDealtTeam::Opposition : EDealtTeam::Crew;
    }

    EDealtMemberRole ReadRole(const FString& Value)
    {
        if (Value.Equals(TEXT("dealer"), ESearchCase::IgnoreCase)) return EDealtMemberRole::Dealer;
        if (Value.Equals(TEXT("enforcer"), ESearchCase::IgnoreCase)) return EDealtMemberRole::Enforcer;
        if (Value.Equals(TEXT("k9"), ESearchCase::IgnoreCase)) return EDealtMemberRole::Dog;
        if (Value.Equals(TEXT("opposition"), ESearchCase::IgnoreCase)) return EDealtMemberRole::Opposition;
        return EDealtMemberRole::Shooter;
    }

    EDealtOutcome ReadOutcome(const FString& Value)
    {
        if (Value.Equals(TEXT("overrun"), ESearchCase::IgnoreCase)) return EDealtOutcome::Overrun;
        if (Value.Equals(TEXT("retreated"), ESearchCase::IgnoreCase)) return EDealtOutcome::Retreated;
        return EDealtOutcome::Secured;
    }

    EDealtInjurySeverity ReadInjurySeverity(const FString& Value)
    {
        if (Value.Equals(TEXT("critical"), ESearchCase::IgnoreCase)) return EDealtInjurySeverity::Critical;
        if (Value.Equals(TEXT("serious"), ESearchCase::IgnoreCase)) return EDealtInjurySeverity::Serious;
        return EDealtInjurySeverity::Minor;
    }

    FString WriteInjurySeverity(EDealtInjurySeverity Value)
    {
        switch (Value)
        {
        case EDealtInjurySeverity::Critical: return TEXT("critical");
        case EDealtInjurySeverity::Serious: return TEXT("serious");
        default: return TEXT("minor");
        }
    }

    FString WriteOutcome(EDealtOutcome Value)
    {
        switch (Value)
        {
        case EDealtOutcome::Overrun: return TEXT("overrun");
        case EDealtOutcome::Retreated: return TEXT("retreated");
        default: return TEXT("secured");
        }
    }

    bool ReadCombatant(const TSharedPtr<FJsonObject>& Object, FDealtCombatant& OutCombatant)
    {
        if (!Object.IsValid()) return false;
        OutCombatant.Id = Object->GetStringField(TEXT("id"));
        OutCombatant.Name = Object->GetStringField(TEXT("name"));
        OutCombatant.Team = ReadTeam(Object->GetStringField(TEXT("team")));
        OutCombatant.Role = ReadRole(Object->GetStringField(TEXT("role")));
        if (!ReadGridPoint(Object->GetObjectField(TEXT("position")), OutCombatant.Position)) return false;
        OutCombatant.Health = Object->GetIntegerField(TEXT("health"));
        OutCombatant.MaxHealth = Object->GetIntegerField(TEXT("maxHealth"));
        OutCombatant.Armor = Object->GetIntegerField(TEXT("armor"));
        OutCombatant.Ammo = Object->GetIntegerField(TEXT("ammo"));
        OutCombatant.MaxAmmo = Object->GetIntegerField(TEXT("maxAmmo"));
        OutCombatant.Level = Object->GetIntegerField(TEXT("level"));
        OutCombatant.bIsDown = Object->GetBoolField(TEXT("isDown"));
        return !OutCombatant.Id.IsEmpty();
    }

    bool ReadStringArray(const TSharedPtr<FJsonObject>& Object, const FString& Field, TArray<FString>& OutValues)
    {
        const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
        if (!Object->TryGetArrayField(Field, Values) || Values == nullptr) return false;
        OutValues.Reset();
        for (const TSharedPtr<FJsonValue>& Value : *Values)
        {
            FString Text;
            if (!Value.IsValid() || !Value->TryGetString(Text)) return false;
            OutValues.Add(Text);
        }
        return true;
    }

    TArray<TSharedPtr<FJsonValue>> WriteStringArray(const TArray<FString>& Values)
    {
        TArray<TSharedPtr<FJsonValue>> JsonValues;
        JsonValues.Reserve(Values.Num());
        for (const FString& Value : Values) JsonValues.Add(MakeShared<FJsonValueString>(Value));
        return JsonValues;
    }
}

bool UDealtContractCodec::LoadEncounterFile(const FString& FilePath, FDealtEncounterPackage& OutEncounter, FString& OutError)
{
    FString Json;
    if (!FFileHelper::LoadFileToString(Json, *FilePath))
    {
        OutError = FString::Printf(TEXT("Could not read encounter file: %s"), *FilePath);
        return false;
    }
    return ParseEncounterJson(Json, OutEncounter, OutError);
}

bool UDealtContractCodec::ParseEncounterJson(const FString& Json, FDealtEncounterPackage& OutEncounter, FString& OutError)
{
    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OutError = TEXT("Encounter JSON is invalid.");
        return false;
    }

    OutEncounter = FDealtEncounterPackage();
    OutEncounter.SchemaVersion = Root->GetIntegerField(TEXT("schemaVersion"));
    if (OutEncounter.SchemaVersion != 1)
    {
        OutError = FString::Printf(TEXT("Unsupported encounter schemaVersion: %d"), OutEncounter.SchemaVersion);
        return false;
    }

    OutEncounter.EncounterId = Root->GetStringField(TEXT("encounterId"));
    OutEncounter.BlockId = Root->GetStringField(TEXT("blockId"));
    OutEncounter.SceneLabel = Root->GetStringField(TEXT("sceneLabel"));
    OutEncounter.LocationReference = Root->GetStringField(TEXT("locationReference"));
    OutEncounter.Seed = Root->GetIntegerField(TEXT("seed"));
    OutEncounter.HeatAtStart = Root->GetIntegerField(TEXT("heatAtStart"));
    OutEncounter.MoraleAtStart = Root->GetIntegerField(TEXT("moraleAtStart"));

    const TArray<TSharedPtr<FJsonValue>>& TerrainRows = Root->GetArrayField(TEXT("terrain"));
    for (const TSharedPtr<FJsonValue>& RowValue : TerrainRows)
    {
        const TArray<TSharedPtr<FJsonValue>>& Cells = RowValue->AsArray();
        for (const TSharedPtr<FJsonValue>& CellValue : Cells)
        {
            const TSharedPtr<FJsonObject> CellObject = CellValue->AsObject();
            if (!CellObject.IsValid())
            {
                OutError = TEXT("Encounter terrain contains an invalid cell.");
                return false;
            }
            FDealtTerrainCell Cell;
            Cell.Point.X = CellObject->GetIntegerField(TEXT("x"));
            Cell.Point.Y = CellObject->GetIntegerField(TEXT("y"));
            Cell.ZoneType = CellObject->GetStringField(TEXT("zoneType"));
            Cell.bPassable = CellObject->GetBoolField(TEXT("passable"));
            Cell.Cover = CellObject->GetNumberField(TEXT("cover"));
            Cell.Exposure = CellObject->GetNumberField(TEXT("exposure"));
            OutEncounter.TerrainCells.Add(Cell);
        }
    }

    auto ReadCombatants = [&OutError](const TArray<TSharedPtr<FJsonValue>>& Values, TArray<FDealtCombatant>& OutValues)
    {
        for (const TSharedPtr<FJsonValue>& Value : Values)
        {
            FDealtCombatant Combatant;
            if (!DealtContract::ReadCombatant(Value->AsObject(), Combatant))
            {
                OutError = TEXT("Encounter contains an invalid combatant.");
                return false;
            }
            OutValues.Add(Combatant);
        }
        return true;
    };

    if (!ReadCombatants(Root->GetArrayField(TEXT("crew")), OutEncounter.Crew)) return false;
    if (!ReadCombatants(Root->GetArrayField(TEXT("opposition")), OutEncounter.Opposition)) return false;

    const TSharedPtr<FJsonObject> Objective = Root->GetObjectField(TEXT("objective"));
    OutEncounter.Objective.Kind = Objective->GetStringField(TEXT("kind"));
    OutEncounter.Objective.Label = Objective->GetStringField(TEXT("label"));
    OutEncounter.Objective.RequiredCrew = Objective->GetIntegerField(TEXT("requiredCrew"));
    OutEncounter.Objective.Progress = Objective->GetIntegerField(TEXT("progress"));
    OutEncounter.Objective.Target = Objective->GetIntegerField(TEXT("target"));
    if (!DealtContract::ReadGridPoint(Objective->GetObjectField(TEXT("extraction")), OutEncounter.Objective.Extraction)
        || !DealtContract::ReadGridPoint(Root->GetObjectField(TEXT("extraction")), OutEncounter.Extraction))
    {
        OutError = TEXT("Encounter extraction point is invalid.");
        return false;
    }

    if (OutEncounter.EncounterId.IsEmpty() || OutEncounter.Crew.IsEmpty())
    {
        OutError = TEXT("Encounter must include an ID and at least one crew member.");
        return false;
    }

    OutError.Reset();
    return true;
}

bool UDealtContractCodec::ParseResultJson(const FString& Json, FDealtEncounterResult& OutResult, FString& OutError)
{
    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OutError = TEXT("Result JSON is invalid.");
        return false;
    }

    OutResult = FDealtEncounterResult();
    OutResult.SchemaVersion = Root->GetIntegerField(TEXT("schemaVersion"));
    if (OutResult.SchemaVersion != 1)
    {
        OutError = FString::Printf(TEXT("Unsupported result schemaVersion: %d"), OutResult.SchemaVersion);
        return false;
    }
    OutResult.EncounterId = Root->GetStringField(TEXT("encounterId"));
    OutResult.IdempotencyKey = Root->GetStringField(TEXT("idempotencyKey"));
    OutResult.Outcome = DealtContract::ReadOutcome(Root->GetStringField(TEXT("outcome")));
    if (!DealtContract::ReadStringArray(Root, TEXT("crewDown"), OutResult.CrewDown)
        || !DealtContract::ReadStringArray(Root, TEXT("oppositionDown"), OutResult.OppositionDown))
    {
        OutError = TEXT("Result downed-member lists are invalid.");
        return false;
    }

    for (const TSharedPtr<FJsonValue>& Value : Root->GetArrayField(TEXT("injuries")))
    {
        const TSharedPtr<FJsonObject> InjuryObject = Value->AsObject();
        FDealtInjury Injury;
        Injury.MemberId = InjuryObject->GetStringField(TEXT("memberId"));
        Injury.Severity = DealtContract::ReadInjurySeverity(InjuryObject->GetStringField(TEXT("severity")));
        Injury.bTreatmentRequired = InjuryObject->GetBoolField(TEXT("treatmentRequired"));
        OutResult.Injuries.Add(Injury);
    }

    const TSharedPtr<FJsonObject> AmmoConsumed = Root->GetObjectField(TEXT("ammoConsumed"));
    for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : AmmoConsumed->Values)
    {
        OutResult.AmmoConsumed.Add(Pair.Key, static_cast<int32>(Pair.Value->AsNumber()));
    }

    for (const TSharedPtr<FJsonValue>& Value : Root->GetArrayField(TEXT("inventoryChanges")))
    {
        const TSharedPtr<FJsonObject> ChangeObject = Value->AsObject();
        FDealtInventoryChange Change;
        Change.ItemId = ChangeObject->GetStringField(TEXT("itemId"));
        Change.QuantityDelta = ChangeObject->GetIntegerField(TEXT("quantityDelta"));
        Change.Reason = ChangeObject->GetStringField(TEXT("reason"));
        OutResult.InventoryChanges.Add(Change);
    }

    OutResult.HeatDelta = Root->GetIntegerField(TEXT("heatDelta"));
    OutResult.MoraleDelta = Root->GetIntegerField(TEXT("moraleDelta"));
    OutResult.PendingIncomeDelta = Root->GetIntegerField(TEXT("pendingIncomeDelta"));
    OutResult.bCapturedBlock = Root->GetBoolField(TEXT("capturedBlock"));
    OutResult.ReplayHash = Root->GetStringField(TEXT("replayHash"));
    OutResult.Summary = Root->GetStringField(TEXT("summary"));
    OutError.Reset();
    return !OutResult.IdempotencyKey.IsEmpty();
}

bool UDealtContractCodec::SerializeResultJson(const FDealtEncounterResult& Result, FString& OutJson, FString& OutError)
{
    if (Result.SchemaVersion != 1 || Result.EncounterId.IsEmpty() || Result.IdempotencyKey.IsEmpty())
    {
        OutError = TEXT("Result is missing its supported schema version, encounter ID, or idempotency key.");
        return false;
    }

    const TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetNumberField(TEXT("schemaVersion"), Result.SchemaVersion);
    Root->SetStringField(TEXT("encounterId"), Result.EncounterId);
    Root->SetStringField(TEXT("idempotencyKey"), Result.IdempotencyKey);
    Root->SetStringField(TEXT("outcome"), DealtContract::WriteOutcome(Result.Outcome));
    Root->SetArrayField(TEXT("crewDown"), DealtContract::WriteStringArray(Result.CrewDown));
    Root->SetArrayField(TEXT("oppositionDown"), DealtContract::WriteStringArray(Result.OppositionDown));

    TArray<TSharedPtr<FJsonValue>> Injuries;
    for (const FDealtInjury& Injury : Result.Injuries)
    {
        const TSharedRef<FJsonObject> Object = MakeShared<FJsonObject>();
        Object->SetStringField(TEXT("memberId"), Injury.MemberId);
        Object->SetStringField(TEXT("severity"), DealtContract::WriteInjurySeverity(Injury.Severity));
        Object->SetBoolField(TEXT("treatmentRequired"), Injury.bTreatmentRequired);
        Injuries.Add(MakeShared<FJsonValueObject>(Object));
    }
    Root->SetArrayField(TEXT("injuries"), Injuries);

    const TSharedRef<FJsonObject> AmmoConsumed = MakeShared<FJsonObject>();
    for (const TPair<FString, int32>& Pair : Result.AmmoConsumed) AmmoConsumed->SetNumberField(Pair.Key, Pair.Value);
    Root->SetObjectField(TEXT("ammoConsumed"), AmmoConsumed);

    TArray<TSharedPtr<FJsonValue>> InventoryChanges;
    for (const FDealtInventoryChange& Change : Result.InventoryChanges)
    {
        const TSharedRef<FJsonObject> Object = MakeShared<FJsonObject>();
        Object->SetStringField(TEXT("itemId"), Change.ItemId);
        Object->SetNumberField(TEXT("quantityDelta"), Change.QuantityDelta);
        Object->SetStringField(TEXT("reason"), Change.Reason);
        InventoryChanges.Add(MakeShared<FJsonValueObject>(Object));
    }
    Root->SetArrayField(TEXT("inventoryChanges"), InventoryChanges);
    Root->SetNumberField(TEXT("heatDelta"), Result.HeatDelta);
    Root->SetNumberField(TEXT("moraleDelta"), Result.MoraleDelta);
    Root->SetNumberField(TEXT("pendingIncomeDelta"), Result.PendingIncomeDelta);
    Root->SetBoolField(TEXT("capturedBlock"), Result.bCapturedBlock);
    Root->SetStringField(TEXT("replayHash"), Result.ReplayHash);
    Root->SetStringField(TEXT("summary"), Result.Summary);

    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutJson);
    if (!FJsonSerializer::Serialize(Root, Writer))
    {
        OutError = TEXT("Could not serialize encounter result.");
        return false;
    }
    OutError.Reset();
    return true;
}
