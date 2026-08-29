#include "DealtActionGameMode.h"

#include "DealtActionPlayerController.h"
#include "DealtCommanderPawn.h"
#include "DealtEncounterSubsystem.h"
#include "DealtMemberPawn.h"
#include "DealtSlideShowdown.h"
#include "DealtSquadDirector.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

namespace DealtGameMode
{
    FVector GridToWorld(const FDealtGridPoint& Point)
    {
        return FVector((Point.X - 3.5) * 320.0, (Point.Y - 3.5) * 320.0, 100.0);
    }
}

ADealtActionGameMode::ADealtActionGameMode()
{
    PlayerControllerClass = ADealtActionPlayerController::StaticClass();
    DefaultPawnClass = ADealtCommanderPawn::StaticClass();
    MemberPawnClass = ADealtMemberPawn::StaticClass();
    SquadDirectorClass = ADealtSquadDirector::StaticClass();
}

void ADealtActionGameMode::BeginPlay()
{
    Super::BeginPlay();

    UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>();
    if (!Encounter)
    {
        UE_LOG(LogDealtShowdown, Error, TEXT("Encounter subsystem is unavailable."));
        return;
    }

    FString Error;
    if (!Encounter->LoadCanonicalEncounter(Error))
    {
        UE_LOG(LogDealtShowdown, Error, TEXT("Could not load canonical 1208 encounter: %s"), *Error);
        return;
    }

    const FDealtEncounterPackage& Package = Encounter->GetEncounter();
    for (const FDealtCombatant& Member : Package.Crew) SpawnCombatant(Member);
    for (const FDealtCombatant& Rival : Package.Opposition) SpawnCombatant(Rival);
    GetWorld()->SpawnActor<ADealtSquadDirector>(SquadDirectorClass, FVector::ZeroVector, FRotator::ZeroRotator);

    // Broadcast after every pawn is registered so the controller can possess the selected member.
    Encounter->SetCameraMode(EDealtCameraMode::ThirdPerson);
}

void ADealtActionGameMode::SpawnCombatant(const FDealtCombatant& Combatant)
{
    if (!MemberPawnClass || !GetWorld()) return;
    const FTransform SpawnTransform(FRotator::ZeroRotator, DealtGameMode::GridToWorld(Combatant.Position));
    ADealtMemberPawn* Pawn = GetWorld()->SpawnActorDeferred<ADealtMemberPawn>(
        MemberPawnClass,
        SpawnTransform,
        nullptr,
        nullptr,
        ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
    if (!Pawn) return;
    Pawn->InitializeFromCombatant(Combatant);
    UGameplayStatics::FinishSpawningActor(Pawn, SpawnTransform);
}
