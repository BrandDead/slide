#pragma once

#include "CoreMinimal.h"
#include "DealtEncounterContracts.generated.h"

UENUM(BlueprintType)
enum class EDealtCameraMode : uint8
{
    Commander,
    FirstPerson,
    ThirdPerson
};

UENUM(BlueprintType)
enum class EDealtControlMode : uint8
{
    Commander,
    Possessed
};

UENUM(BlueprintType)
enum class EDealtTeam : uint8
{
    Crew,
    Opposition
};

UENUM(BlueprintType)
enum class EDealtMemberRole : uint8
{
    Shooter,
    Dealer,
    Enforcer,
    Dog,
    Opposition
};

UENUM(BlueprintType)
enum class EDealtOutcome : uint8
{
    Secured,
    Overrun,
    Retreated
};

UENUM(BlueprintType)
enum class EDealtImpactKind : uint8
{
    Actor,
    Cover,
    Vehicle,
    Environment,
    Miss
};

UENUM(BlueprintType)
enum class EDealtHitZone : uint8
{
    Head,
    Torso,
    Arm,
    Leg
};

USTRUCT(BlueprintType)
struct FDealtGridPoint
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 X = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Y = 0;
};

USTRUCT(BlueprintType)
struct FDealtVector3
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double X = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Y = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Z = 0.0;

    FVector ToUnreal(double CentimetersPerUnit = 100.0) const
    {
        return FVector(X, Z, Y) * CentimetersPerUnit;
    }
};

USTRUCT(BlueprintType)
struct FDealtTerrainCell
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtGridPoint Point;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString ZoneType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bPassable = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Cover = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Exposure = 0.0;
};

USTRUCT(BlueprintType)
struct FDealtCombatant
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Id;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDealtTeam Team = EDealtTeam::Crew;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDealtMemberRole Role = EDealtMemberRole::Shooter;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtGridPoint Position;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Health = 100;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MaxHealth = 100;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Armor = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Ammo = 8;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MaxAmmo = 8;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Level = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bIsDown = false;
};

USTRUCT(BlueprintType)
struct FDealtObjective
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Kind;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Label;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtGridPoint Extraction;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 RequiredCrew = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Progress = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Target = 1;
};

USTRUCT(BlueprintType)
struct FDealtEncounterPackage
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 SchemaVersion = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString EncounterId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString BlockId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString SceneLabel;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString LocationReference;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Seed = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FDealtTerrainCell> TerrainCells;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FDealtCombatant> Crew;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FDealtCombatant> Opposition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtObjective Objective;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtGridPoint Extraction;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 HeatAtStart = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MoraleAtStart = 100;
};

USTRUCT(BlueprintType)
struct FDealtInventoryChange
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString ItemId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 QuantityDelta = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Reason;
};

USTRUCT(BlueprintType)
struct FDealtInjury
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString MemberId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Severity = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Cause;
};

USTRUCT(BlueprintType)
struct FDealtEncounterResult
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 SchemaVersion = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString EncounterId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString IdempotencyKey;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDealtOutcome Outcome = EDealtOutcome::Secured;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FString> CrewDown;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FString> OppositionDown;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FDealtInjury> Injuries;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TMap<FString, int32> AmmoConsumed;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FDealtInventoryChange> InventoryChanges;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 HeatDelta = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MoraleDelta = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 PendingIncomeDelta = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCapturedBlock = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString ReplayHash;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Summary;
};

USTRUCT(BlueprintType)
struct FDealtAimRay
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtVector3 Origin;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtVector3 Direction;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double MaxDistance = 40.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClientTick = 0;
};

USTRUCT(BlueprintType)
struct FDealtImpactCandidate
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDealtImpactKind Kind = EDealtImpactKind::Miss;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString EntityId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDealtHitZone HitZone = EDealtHitZone::Torso;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FDealtVector3 Point;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Distance = 0.0;
};
