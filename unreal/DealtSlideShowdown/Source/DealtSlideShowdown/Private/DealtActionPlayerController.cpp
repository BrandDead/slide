#include "DealtActionPlayerController.h"

#include "DealtCommanderPawn.h"
#include "DealtEncounterSubsystem.h"
#include "DealtMemberPawn.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/InputSettings.h"

ADealtActionPlayerController::ADealtActionPlayerController()
{
    bShowMouseCursor = false;
    bEnableClickEvents = false;
    bEnableMouseOverEvents = false;
}

void ADealtActionPlayerController::BeginPlay()
{
    Super::BeginPlay();
    if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
    {
        Encounter->OnPossessionChanged.AddDynamic(this, &ADealtActionPlayerController::HandlePossessionChanged);
    }
    ApplyCurrentPossession();
}

void ADealtActionPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    check(InputComponent);
    InputComponent->BindAxis(TEXT("MoveForward"), this, &ADealtActionPlayerController::MoveForward);
    InputComponent->BindAxis(TEXT("MoveRight"), this, &ADealtActionPlayerController::MoveRight);
    InputComponent->BindAxis(TEXT("Turn"), this, &ADealtActionPlayerController::Turn);
    InputComponent->BindAxis(TEXT("LookUp"), this, &ADealtActionPlayerController::LookUp);
    InputComponent->BindAction(TEXT("Fire"), IE_Pressed, this, &ADealtActionPlayerController::Fire);
    InputComponent->BindAction(TEXT("CycleCamera"), IE_Pressed, this, &ADealtActionPlayerController::CycleCameraMode);
    InputComponent->BindAction(TEXT("NextMember"), IE_Pressed, this, &ADealtActionPlayerController::NextMember);
    InputComponent->BindAction(TEXT("PreviousMember"), IE_Pressed, this, &ADealtActionPlayerController::PreviousMember);
}

void ADealtActionPlayerController::HandlePossessionChanged(EDealtControlMode ControlMode, const FString& MemberId)
{
    ApplyCurrentPossession();
}

ADealtMemberPawn* ADealtActionPlayerController::GetControlledMember() const
{
    return Cast<ADealtMemberPawn>(GetPawn());
}

void ADealtActionPlayerController::MoveForward(float Value)
{
    ForwardInput = Value;
    if (ADealtMemberPawn* Member = GetControlledMember())
    {
        Member->MoveMember(FVector2D(RightInput, ForwardInput));
        return;
    }
    if (CommanderPawn && GetPawn() == CommanderPawn)
    {
        CommanderPawn->PanCommander(FVector2D(RightInput, ForwardInput), GetWorld()->GetDeltaSeconds());
    }
}

void ADealtActionPlayerController::MoveRight(float Value)
{
    RightInput = Value;
    if (ADealtMemberPawn* Member = GetControlledMember())
    {
        Member->MoveMember(FVector2D(RightInput, ForwardInput));
        return;
    }
    if (CommanderPawn && GetPawn() == CommanderPawn)
    {
        CommanderPawn->PanCommander(FVector2D(RightInput, ForwardInput), GetWorld()->GetDeltaSeconds());
    }
}

void ADealtActionPlayerController::Turn(float Value)
{
    if (ADealtMemberPawn* Member = GetControlledMember()) Member->LookMember(FVector2D(Value, 0.0f));
}

void ADealtActionPlayerController::LookUp(float Value)
{
    if (ADealtMemberPawn* Member = GetControlledMember()) Member->LookMember(FVector2D(0.0f, Value));
}

void ADealtActionPlayerController::Fire()
{
    if (ADealtMemberPawn* Member = GetControlledMember()) Member->FireMemberWeapon();
}

void ADealtActionPlayerController::CycleCameraMode()
{
    UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>();
    if (!Encounter) return;
    const EDealtCameraMode Current = Encounter->GetCameraMode();
    const EDealtCameraMode Next = Current == EDealtCameraMode::Commander
        ? EDealtCameraMode::ThirdPerson
        : Current == EDealtCameraMode::ThirdPerson
            ? EDealtCameraMode::FirstPerson
            : EDealtCameraMode::Commander;
    Encounter->SetCameraMode(Next);
}

void ADealtActionPlayerController::NextMember()
{
    if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
    {
        Encounter->CycleSelectedMember(1);
    }
}

void ADealtActionPlayerController::PreviousMember()
{
    if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
    {
        Encounter->CycleSelectedMember(-1);
    }
}

void ADealtActionPlayerController::ApplyCurrentPossession()
{
    UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>();
    if (!Encounter || !GetWorld()) return;

    APawn* TargetPawn = nullptr;
    if (Encounter->GetControlMode() == EDealtControlMode::Commander)
    {
        if (!CommanderPawn)
        {
            CommanderPawn = GetWorld()->SpawnActor<ADealtCommanderPawn>(ADealtCommanderPawn::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
        }
        TargetPawn = CommanderPawn;
    }
    else
    {
        ADealtMemberPawn* Member = Encounter->FindMemberPawn(Encounter->GetSelectedMemberId());
        if (Member && Member->IsAvailableForPossession())
        {
            Member->ApplyCameraMode(Encounter->GetCameraMode());
            TargetPawn = Member;
        }
    }

    if (!TargetPawn || GetPawn() == TargetPawn) return;
    if (ADealtMemberPawn* PreviousMember = Cast<ADealtMemberPawn>(GetPawn()))
    {
        UnPossess();
        if (PreviousMember->IsAvailableForPossession()) PreviousMember->SpawnDefaultController();
    }
    Possess(TargetPawn);
}
