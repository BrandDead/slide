#include "DealtMemberPawn.h"

#include "AIController.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "DealtEncounterSubsystem.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

ADealtMemberPawn::ADealtMemberPawn()
{
    PrimaryActorTick.bCanEverTick = false;
    bUseControllerRotationPitch = false;
    bUseControllerRotationRoll = false;
    bUseControllerRotationYaw = false;
    AIControllerClass = AAIController::StaticClass();
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;

    GetCapsuleComponent()->InitCapsuleSize(42.0f, 92.0f);
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.0f, 620.0f, 0.0f);
    GetCharacterMovement()->MaxWalkSpeed = 470.0f;
    GetCharacterMovement()->MaxWalkSpeedCrouched = 225.0f;
    GetCharacterMovement()->BrakingDecelerationWalking = 1700.0f;

    ThirdPersonArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("ThirdPersonArm"));
    ThirdPersonArm->SetupAttachment(GetRootComponent());
    ThirdPersonArm->TargetArmLength = 430.0f;
    ThirdPersonArm->SocketOffset = FVector(0.0f, 72.0f, 68.0f);
    ThirdPersonArm->bUsePawnControlRotation = true;
    ThirdPersonArm->bEnableCameraLag = true;
    ThirdPersonArm->CameraLagSpeed = 14.0f;
    ThirdPersonArm->bDoCollisionTest = true;

    ThirdPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ThirdPersonCamera"));
    ThirdPersonCamera->SetupAttachment(ThirdPersonArm, USpringArmComponent::SocketName);
    ThirdPersonCamera->bUsePawnControlRotation = false;

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    FirstPersonCamera->SetRelativeLocation(FVector(8.0f, 0.0f, 68.0f));
    FirstPersonCamera->bUsePawnControlRotation = true;
    FirstPersonCamera->SetActive(false);
}

void ADealtMemberPawn::BeginPlay()
{
    Super::BeginPlay();
    if (!MemberId.IsEmpty())
    {
        if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
        {
            Encounter->RegisterMemberPawn(MemberId, this);
        }
    }
}

void ADealtMemberPawn::InitializeFromCombatant(const FDealtCombatant& Combatant)
{
    MemberId = Combatant.Id;
    CurrentHealth = Combatant.Health;
    bIsDown = Combatant.bIsDown;
    Tags.RemoveAll([](const FName& Tag) { return Tag.ToString().StartsWith(TEXT("dealt.actor:")); });
    Tags.Add(*FString::Printf(TEXT("dealt.actor:%s"), *MemberId));
    GetMesh()->ComponentTags.AddUnique(TEXT("hit:torso"));

    if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
    {
        Encounter->RegisterMemberPawn(MemberId, this);
    }
}

void ADealtMemberPawn::ApplyCameraMode(EDealtCameraMode CameraMode)
{
    const bool bFirstPerson = CameraMode == EDealtCameraMode::FirstPerson;
    FirstPersonCamera->SetActive(bFirstPerson);
    ThirdPersonCamera->SetActive(!bFirstPerson);
    bUseControllerRotationYaw = bFirstPerson;
    GetCharacterMovement()->bOrientRotationToMovement = !bFirstPerson;
    GetMesh()->SetOwnerNoSee(bFirstPerson);
}

void ADealtMemberPawn::MoveMember(const FVector2D& Input)
{
    if (!Controller || !IsAvailableForPossession()) return;
    const FRotator ControlRotation = Controller->GetControlRotation();
    const FRotator YawRotation(0.0f, ControlRotation.Yaw, 0.0f);
    const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
    const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);
    AddMovementInput(Forward, Input.Y);
    AddMovementInput(Right, Input.X);
}

void ADealtMemberPawn::LookMember(const FVector2D& Input)
{
    AddControllerYawInput(Input.X);
    AddControllerPitchInput(Input.Y);
}

FDealtAimedFireCommand ADealtMemberPawn::FireMemberWeapon(double MaxDistanceMeters)
{
    FDealtAimedFireCommand EmptyCommand;
    if (!IsAvailableForPossession() || MemberId.IsEmpty()) return EmptyCommand;

    UCameraComponent* ActiveCamera = FirstPersonCamera->IsActive() ? FirstPersonCamera : ThirdPersonCamera;
    if (!ActiveCamera || !GetWorld()) return EmptyCommand;

    const FVector Start = ActiveCamera->GetComponentLocation();
    const FVector Direction = ActiveCamera->GetForwardVector().GetSafeNormal();
    const double RangeMeters = MaxDistanceMeters > 0.0 ? MaxDistanceMeters : FireRangeMeters;
    const FVector End = Start + Direction * RangeMeters * 100.0;
    FCollisionQueryParams QueryParams(SCENE_QUERY_STAT(DealtMemberFire), true, this);
    QueryParams.AddIgnoredActor(this);
    FHitResult Hit;
    GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, QueryParams);

    if (UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>())
    {
        return Encounter->SubmitNativeHit(MemberId, Start, Direction, RangeMeters, ClientTick++, Hit);
    }
    return EmptyCommand;
}
